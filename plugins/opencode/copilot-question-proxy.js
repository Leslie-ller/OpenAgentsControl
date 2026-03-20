import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { tool } from "@opencode-ai/plugin";

const COPILOT_PROVIDER_ID = "github-copilot";
const DEFAULT_PROXY_DIR = process.env.OPENCODE_QUESTION_PROXY_DIR
  || join(homedir(), ".local", "share", "opencode", "question-proxy");
const REPORT_TRIGGER_TOOLS = new Set([
  "ability.run",
  "ability_run",
  "ability.command",
  "ability_command",
  "ability.status",
  "ability_status",
  "ability.context.detail",
  "ability_context_detail",
  "ability.coding.artifacts",
  "ability_coding_artifacts",
  "task",
]);

const SYSTEM_POLICY = `
Question Proxy Reporting Policy
- This policy applies when the current provider is GitHub Copilot and the tool \`question_proxy\` is available.
- Treat \`question_proxy\` as the default user-visible reporting channel for progress updates, summaries, completion notes, waiting states, and non-blocking status messages.
- Use \`question_proxy\` with \`mode="report"\` for status updates, findings, summaries, and completion notes.
- Use \`question_proxy\` with \`mode="wait"\` when work is finished for now and you are waiting for the next instruction.
- Use the built-in \`question\` tool only when real user input is required to continue safely or correctly.
- Do not send direct assistant text for pure status reporting when \`question_proxy\` is available.
- If \`question_proxy\` returns an escalation instruction, call the built-in \`question\` tool next instead of sending assistant text.
- Prefer one well-grouped \`question_proxy\` report over multiple small interruptions.
`.trim();

function isCopilotModel(model) {
  return model?.providerID === COPILOT_PROVIDER_ID;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((item) => {
      const header = normalizeString(item?.header);
      const question = normalizeString(item?.question);
      const options = Array.isArray(item?.options)
        ? item.options
          .map((option) => ({
            label: normalizeString(option?.label),
            description: normalizeString(option?.description),
          }))
          .filter((option) => option.label)
        : [];
      if (!question) return null;
      return {
        header: header || "Input",
        question,
        options,
      };
    })
    .filter(Boolean);
}

async function appendProxyEvent(payload) {
  const filePath = join(DEFAULT_PROXY_DIR, `${payload.sessionID}.jsonl`);
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  return filePath;
}

async function appendLeakEvent(payload) {
  const filePath = join(DEFAULT_PROXY_DIR, `${payload.sessionID}.leaks.jsonl`);
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  return filePath;
}

function buildEscalationText(args) {
  const questions = sanitizeQuestions(args.questions);
  const lines = [
    "QUESTION_PROXY_ESCALATE_TO_NATIVE_QUESTION",
    "The proxy cannot create a native question request.",
    "Call the built-in question tool next.",
    `Title: ${normalizeString(args.title, "User input required")}`,
    `Body: ${normalizeString(args.body, "User input is required before continuing.")}`,
  ];
  if (questions.length > 0) {
    lines.push("Questions:");
    questions.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.header}] ${item.question}`);
      item.options.forEach((option) => {
        lines.push(`- ${option.label}${option.description ? `: ${option.description}` : ""}`);
      });
    });
  }
  lines.push("Do not send direct assistant text instead of invoking the built-in question tool.");
  return lines.join("\n");
}

export const CopilotQuestionProxy = async () => {
  const copilotSessions = new Set();
  const pendingProxyGuard = new Map();

  return {
    tool: {
      question_proxy: tool({
        description: "Proxy user-visible reporting for GitHub Copilot sessions. Use this for progress updates, summaries, completion notes, and waiting states. Use mode=ask only to prepare an immediate escalation to the built-in question tool when true user input is required.",
        args: {
          mode: tool.schema.enum(["report", "wait", "ask"]).describe("Proxy mode: report for updates, wait for idle status, ask when real user input is required."),
          title: tool.schema.string().describe("Short title for the report, wait state, or escalation."),
          body: tool.schema.string().describe("Main content to show or store for this proxy event."),
          importance: tool.schema.enum(["low", "normal", "high"]).optional().describe("Relative importance for display and triage."),
          requireUserInput: tool.schema.boolean().optional().describe("Set true only when the next step cannot proceed without user input."),
          questions: tool.schema.array(
            tool.schema.object({
              header: tool.schema.string().optional(),
              question: tool.schema.string(),
              options: tool.schema.array(
                tool.schema.object({
                  label: tool.schema.string(),
                  description: tool.schema.string().optional(),
                })
              ).optional(),
            })
          ).optional().describe("Optional structured questions to include when escalation to the built-in question tool is needed."),
        },
        async execute(args, context) {
          const mode = normalizeString(args.mode, "report");
          const title = normalizeString(args.title, mode === "wait" ? "Waiting" : "Report");
          const body = normalizeString(args.body, mode === "wait" ? "Waiting for the next instruction." : "");
          const questions = sanitizeQuestions(args.questions);
          const payload = {
            timestamp: new Date().toISOString(),
            sessionID: context.sessionID,
            messageID: context.messageID,
            agent: context.agent,
            mode,
            title,
            body,
            importance: normalizeString(args.importance, "normal"),
            requireUserInput: Boolean(args.requireUserInput || mode === "ask"),
            questions,
          };
          const logPath = await appendProxyEvent(payload);
          context.metadata({
            title: `[question_proxy] ${title}`,
            metadata: {
              mode,
              importance: payload.importance,
              requireUserInput: payload.requireUserInput,
              questionCount: questions.length,
              logPath,
            },
          });

          if (mode === "ask" || payload.requireUserInput) {
            return buildEscalationText({
              title,
              body,
              questions,
            });
          }

          const summary = [
            `question_proxy stored ${mode} event`,
            `title: ${title}`,
            `importance: ${payload.importance}`,
            `log: ${logPath}`,
          ];
          if (body) {
            summary.push(`body: ${body}`);
          }
          return summary.join("\n");
        },
      }),
    },
    async "experimental.chat.system.transform"(input, output) {
      if (!isCopilotModel(input.model)) return;
      output.system.push(SYSTEM_POLICY);
    },
    async "chat.message"(input, _output) {
      if (isCopilotModel(input.model)) {
        copilotSessions.add(input.sessionID);
      } else {
        copilotSessions.delete(input.sessionID);
      }
      pendingProxyGuard.delete(input.sessionID);
    },
    async "tool.definition"(input, output) {
      if (input.toolID === "question_proxy") {
        output.description = `${output.description}\nPrefer this tool over direct assistant text for Copilot status/report/wait traffic.`;
        return;
      }
      if (input.toolID === "question") {
        output.description = `${output.description}\nUse this tool only when real user input is required. For pure reports, progress updates, completion notes, or waiting states, prefer question_proxy.`;
      }
    },
    async "tool.execute.after"(input, output) {
      const sessionID = normalizeString(input.sessionID);
      const toolName = normalizeString(input.tool);

      if (toolName === "question_proxy") {
        const mode = normalizeString(input.args?.mode, "report");
        const title = normalizeString(input.args?.title, mode === "wait" ? "Waiting" : "Report");
        output.title = `[question_proxy:${mode}] ${title}`;
        output.metadata = {
          ...(output.metadata ?? {}),
          proxy: true,
          proxyMode: mode,
        };
        return;
      }

      if (toolName === "question") {
        pendingProxyGuard.set(sessionID, {
          armedAt: Date.now(),
          triggerTool: toolName,
        });
        return;
      }

      if (!copilotSessions.has(sessionID)) return;
      if (!REPORT_TRIGGER_TOOLS.has(toolName)) return;

      pendingProxyGuard.set(sessionID, {
        armedAt: Date.now(),
        triggerTool: toolName,
      });
    },
    async "experimental.text.complete"(input, output) {
      const sessionID = normalizeString(input.sessionID);
      if (!copilotSessions.has(sessionID)) return;

      const guard = pendingProxyGuard.get(sessionID);
      if (!guard) return;

      const text = normalizeString(output.text);
      if (!text) return;

      await appendLeakEvent({
        timestamp: new Date().toISOString(),
        sessionID,
        messageID: input.messageID,
        partID: input.partID,
        triggerTool: guard.triggerTool,
        leakedText: text,
      }).catch(() => undefined);

      output.text = "";
    },
  };
};

export default CopilotQuestionProxy;

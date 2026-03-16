import { constants } from "fs"
import { access, readFile } from "fs/promises"
import { resolve } from "path"
import { tool } from "@opencode-ai/plugin/tool"

type BibliographyStage =
  | "plan"
  | "screening"
  | "review"
  | "decision"
  | "evidence-pack"
  | "audit"

type Capability = "agentos_cli" | "agentos_mcp" | "academic_search" | "zotero" | "mineru"

interface CapabilityStatus {
  capability: Capability
  ready: boolean
  details: string
  requiredBy: BibliographyStage[]
}

interface AgentOSEnv {
  [key: string]: string
}

const AGENTOS_ROOT = "/home/leslie/code/AgentOS"
const AGENTOS_CLI = `${AGENTOS_ROOT}/.venv/bin/agentos`
const AGENTOS_MCP = `${AGENTOS_ROOT}/.venv/bin/agentos-mcp`
const AGENTOS_ENV = `${AGENTOS_ROOT}/.env`

const STAGE_REQUIREMENTS: Record<BibliographyStage, Capability[]> = {
  plan: ["agentos_cli"],
  screening: ["agentos_cli", "academic_search", "zotero"],
  review: ["agentos_cli", "agentos_mcp", "zotero", "mineru"],
  decision: ["agentos_cli", "zotero"],
  "evidence-pack": ["agentos_cli"],
  audit: ["agentos_cli", "zotero"],
}

async function executableExists(path: string): Promise<boolean> {
  try {
    await access(resolve(path), constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function loadAgentOSEnv(): Promise<AgentOSEnv> {
  try {
    const raw = await readFile(AGENTOS_ENV, "utf8")
    const env: AgentOSEnv = {}
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue
      }
      const [key, ...parts] = trimmed.split("=")
      env[key.trim()] = parts.join("=").trim()
    }
    return env
  } catch {
    return {}
  }
}

function stageList(capability: Capability): BibliographyStage[] {
  return (Object.keys(STAGE_REQUIREMENTS) as BibliographyStage[]).filter((stage) =>
    STAGE_REQUIREMENTS[stage].includes(capability),
  )
}

async function inspectAgentOSCli(): Promise<CapabilityStatus> {
  const ready = await executableExists(AGENTOS_CLI)
  return {
    capability: "agentos_cli",
    ready,
    details: ready
      ? `found \`${AGENTOS_CLI}\``
      : `missing executable \`${AGENTOS_CLI}\``,
    requiredBy: stageList("agentos_cli"),
  }
}

async function inspectAgentOSMcp(): Promise<CapabilityStatus> {
  const ready = await executableExists(AGENTOS_MCP)
  return {
    capability: "agentos_mcp",
    ready,
    details: ready
      ? `found \`${AGENTOS_MCP}\``
      : `missing executable \`${AGENTOS_MCP}\``,
    requiredBy: stageList("agentos_mcp"),
  }
}

function inspectAcademicSearch(env: AgentOSEnv): CapabilityStatus {
  const openAlex = Boolean(env.OPENALEX_EMAIL)
  const s2 = Boolean(env.S2_API_KEY)
  const ready = true
  const configured = [
    openAlex ? "OPENALEX_EMAIL" : "",
    s2 ? "S2_API_KEY" : "",
  ].filter(Boolean)

  return {
    capability: "academic_search",
    ready,
    details: configured.length > 0
      ? `academic search available via AgentOS search; configured extras: ${configured.join(", ")}`
      : "academic search available via AgentOS search (OpenAlex + ArXiv baseline, no optional extras configured)",
    requiredBy: stageList("academic_search"),
  }
}

function inspectZotero(env: AgentOSEnv): CapabilityStatus {
  const hasApi = Boolean(env.ZOTERO_USER_ID && env.ZOTERO_API_KEY)
  const hasLocalAttachmentPath = Boolean(
    env.ZOTERO_STORAGE_DIR || env.ZOTERO_DATA_DIR || env.ZOTERO_LINKED_ATTACHMENT_BASE_DIR,
  )
  const ready = hasApi
  let details = "missing Zotero API config in AgentOS .env"

  if (hasApi && hasLocalAttachmentPath) {
    details = "Zotero API and local attachment fallback are configured"
  } else if (hasApi) {
    details = "Zotero API is configured"
  } else if (hasLocalAttachmentPath) {
    details = "local Zotero attachment paths exist, but API config is missing"
  }

  return {
    capability: "zotero",
    ready,
    details,
    requiredBy: stageList("zotero"),
  }
}

function inspectMineru(env: AgentOSEnv): CapabilityStatus {
  const hasMineru = Boolean(env.MINERU_API_TOKEN)
  const hasMineruKie = Boolean(env.MINERU_KIE_API_TOKEN && env.MINERU_KIE_PIPELINE_ID)
  const ready = hasMineru || hasMineruKie

  let details = "missing MinerU config in AgentOS .env"
  if (hasMineru && hasMineruKie) {
    details = "MinerU API and MinerU KIE are both configured"
  } else if (hasMineru) {
    details = "MinerU API is configured"
  } else if (hasMineruKie) {
    details = "MinerU KIE is configured"
  }

  return {
    capability: "mineru",
    ready,
    details,
    requiredBy: stageList("mineru"),
  }
}

export interface BibliographyToolingReport {
  stage: BibliographyStage | "all"
  ready: boolean
  requiredCapabilities: Capability[]
  missingRequired: Capability[]
  capabilities: CapabilityStatus[]
  toolchain: {
    agentosRoot: string
    envFile: string
  }
}

export async function inspectBibliographyTooling(
  stage: BibliographyStage | "all" = "all",
): Promise<BibliographyToolingReport> {
  const env = await loadAgentOSEnv()
  const capabilities = [
    await inspectAgentOSCli(),
    await inspectAgentOSMcp(),
    inspectAcademicSearch(env),
    inspectZotero(env),
    inspectMineru(env),
  ]

  const requiredCapabilities = stage === "all"
    ? Array.from(new Set((Object.values(STAGE_REQUIREMENTS).flat()))) as Capability[]
    : STAGE_REQUIREMENTS[stage]

  const missingRequired = requiredCapabilities.filter((capability) => {
    const status = capabilities.find((item) => item.capability === capability)
    return !status || !status.ready
  })

  return {
    stage,
    ready: missingRequired.length === 0,
    requiredCapabilities,
    missingRequired,
    capabilities,
    toolchain: {
      agentosRoot: AGENTOS_ROOT,
      envFile: AGENTOS_ENV,
    },
  }
}

function formatReport(report: BibliographyToolingReport): string {
  const required = report.requiredCapabilities.map((item) => `\`${item}\``).join(", ") || "_none_"
  const missing = report.missingRequired.map((item) => `\`${item}\``).join(", ") || "_none_"
  const lines = [
    `# Bibliography tooling status${report.stage === "all" ? "" : ` for ${report.stage}`}`,
    "",
    `status: ${report.ready ? "ready" : "not ready"}`,
    `agentos root: \`${report.toolchain.agentosRoot}\``,
    `agentos env: \`${report.toolchain.envFile}\``,
    `required capabilities: ${required}`,
    `missing required: ${missing}`,
    "",
    "## Capability details",
  ]

  for (const capability of report.capabilities) {
    lines.push(`- \`${capability.capability}\`: ${capability.ready ? "ready" : "missing"}; ${capability.details}`)
  }

  return lines.join("\n")
}

export const status = tool({
  description: "Inspect whether the local AgentOS-based bibliography toolchain is ready",
  args: {
    stage: tool.schema
      .enum(["all", "plan", "screening", "review", "decision", "evidence-pack", "audit"])
      .optional()
      .describe("Bibliography workflow stage to validate"),
  },
  async execute(args) {
    try {
      return formatReport(await inspectBibliographyTooling(args.stage ?? "all"))
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})

export const requireReady = tool({
  description: "Check whether the local AgentOS-based bibliography toolchain is ready for a stage",
  args: {
    stage: tool.schema
      .enum(["plan", "screening", "review", "decision", "evidence-pack", "audit"])
      .describe("Bibliography workflow stage to validate"),
  },
  async execute(args) {
    try {
      const report = await inspectBibliographyTooling(args.stage)
      if (report.ready) {
        return `Bibliography tooling ready for ${args.stage}.`
      }
      return [
        `Bibliography tooling is not ready for ${args.stage}.`,
        formatReport(report),
      ].join("\n\n")
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})

export default status

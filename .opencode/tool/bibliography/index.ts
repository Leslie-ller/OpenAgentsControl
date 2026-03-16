import { constants } from "fs"
import { access } from "fs/promises"
import { spawnSync } from "child_process"
import { resolve } from "path"
import { tool } from "@opencode-ai/plugin/tool"
import { getEnvVariable, loadEnvVariables } from "../env"

type BibliographyStage =
  | "plan"
  | "screening"
  | "review"
  | "decision"
  | "evidence-pack"
  | "audit"

type Capability = "discovery" | "pdf_extract" | "reference_manager"

interface CapabilityStatus {
  capability: Capability
  configured: boolean
  envVar: string | null
  value: string | null
  executable: string | null
  executableFound: boolean
  requiredBy: BibliographyStage[]
}

const STAGE_REQUIREMENTS: Record<BibliographyStage, Capability[]> = {
  plan: [],
  screening: ["discovery", "reference_manager"],
  review: ["pdf_extract", "reference_manager"],
  decision: ["reference_manager"],
  "evidence-pack": [],
  audit: ["reference_manager"],
}

const CAPABILITY_ENV_VARS: Record<Capability, string[]> = {
  discovery: ["BIBLIOGRAPHY_DISCOVERY_CMD", "BIBLIOGRAPHY_SEARCH_CMD"],
  pdf_extract: ["BIBLIOGRAPHY_PDF_EXTRACT_CMD", "BIBLIOGRAPHY_PDF_CMD", "MINERU_CMD"],
  reference_manager: [
    "BIBLIOGRAPHY_REFERENCE_MANAGER_CMD",
    "BIBLIOGRAPHY_ZOTERO_CMD",
    "ZOTERO_CMD",
  ],
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function extractExecutable(commandValue: string): string | null {
  const tokens = commandValue.match(/"[^"]*"|'[^']*'|\S+/g)
  if (!tokens || tokens.length === 0) {
    return null
  }

  return tokens[0].replace(/^['"]|['"]$/g, "")
}

async function executableExists(executable: string | null): Promise<boolean> {
  if (!executable) {
    return false
  }

  if (executable.includes("/") || executable.startsWith(".")) {
    try {
      await access(resolve(executable), constants.X_OK)
      return true
    } catch {
      return false
    }
  }

  const result = spawnSync("bash", ["-lc", `command -v ${shellEscape(executable)}`], {
    stdio: "ignore",
  })
  return result.status === 0
}

async function readConfiguredValue(envVars: string[]): Promise<{ envVar: string | null; value: string | null }> {
  for (const envVar of envVars) {
    const value = await getEnvVariable(envVar)
    if (value) {
      return { envVar, value }
    }
  }

  return { envVar: null, value: null }
}

async function inspectCapability(capability: Capability): Promise<CapabilityStatus> {
  const requiredBy = Object.entries(STAGE_REQUIREMENTS)
    .filter(([, capabilities]) => capabilities.includes(capability))
    .map(([stage]) => stage as BibliographyStage)

  const { envVar, value } = await readConfiguredValue(CAPABILITY_ENV_VARS[capability])
  const executable = value ? extractExecutable(value) : null
  const executableFound = await executableExists(executable)

  return {
    capability,
    configured: Boolean(value),
    envVar,
    value,
    executable,
    executableFound,
    requiredBy,
  }
}

export interface BibliographyToolingReport {
  stage: BibliographyStage | "all"
  ready: boolean
  requiredCapabilities: Capability[]
  missingRequired: Capability[]
  capabilities: CapabilityStatus[]
}

export async function inspectBibliographyTooling(
  stage: BibliographyStage | "all" = "all",
): Promise<BibliographyToolingReport> {
  await loadEnvVariables()

  const capabilities = await Promise.all(
    (Object.keys(CAPABILITY_ENV_VARS) as Capability[]).map(inspectCapability),
  )

  const requiredCapabilities = stage === "all"
    ? (Object.keys(CAPABILITY_ENV_VARS) as Capability[])
    : STAGE_REQUIREMENTS[stage]

  const missingRequired = requiredCapabilities.filter((capability) => {
    const status = capabilities.find((item) => item.capability === capability)
    return !status || !status.configured || !status.executableFound
  })

  return {
    stage,
    ready: missingRequired.length === 0,
    requiredCapabilities,
    missingRequired,
    capabilities,
  }
}

function formatCapability(status: CapabilityStatus): string {
  const configured = status.configured ? "configured" : "missing"
  const executable = status.executableFound ? "executable-ok" : "executable-missing"
  const value = status.value ? `\`${status.value}\`` : "_not set_"
  const source = status.envVar ? ` via \`${status.envVar}\`` : ""
  const requiredBy = status.requiredBy.length > 0
    ? status.requiredBy.map((stage) => `\`${stage}\``).join(", ")
    : "_none_"

  return [
    `- \`${status.capability}\`: ${configured}, ${executable}${source}`,
    `  value: ${value}`,
    `  required by: ${requiredBy}`,
  ].join("\n")
}

function formatReport(report: BibliographyToolingReport): string {
  const title = report.stage === "all"
    ? "Bibliography tooling status"
    : `Bibliography tooling status for ${report.stage}`
  const readiness = report.ready ? "ready" : "not ready"
  const required = report.requiredCapabilities.length > 0
    ? report.requiredCapabilities.map((item) => `\`${item}\``).join(", ")
    : "_none_"
  const missing = report.missingRequired.length > 0
    ? report.missingRequired.map((item) => `\`${item}\``).join(", ")
    : "_none_"

  return [
    `# ${title}`,
    "",
    `status: ${readiness}`,
    `required capabilities: ${required}`,
    `missing required: ${missing}`,
    "",
    "## Capability details",
    ...report.capabilities.map(formatCapability),
  ].join("\n")
}

export const status = tool({
  description: "Inspect bibliography workflow tooling configuration and stage readiness",
  args: {
    stage: tool.schema
      .enum(["all", "plan", "screening", "review", "decision", "evidence-pack", "audit"])
      .optional()
      .describe("Bibliography workflow stage to validate"),
  },
  async execute(args) {
    try {
      const report = await inspectBibliographyTooling(args.stage ?? "all")
      return formatReport(report)
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})

export const requireReady = tool({
  description: "Check bibliography stage tooling and return an error-style response when required capabilities are missing",
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
        `Missing required capabilities: ${report.missingRequired.join(", ") || "none"}.`,
        "",
        formatReport(report),
      ].join("\n")
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})

export default status

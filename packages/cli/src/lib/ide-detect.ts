import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdeType = "opencode" | "cursor" | "claude" | "windsurf";

export type DetectedIde = {
  type: IdeType;
  detected: boolean;
  /** Human-readable description of what was found (or checked). */
  indicator: string;
};

// ─── IDE Definitions ──────────────────────────────────────────────────────────

/** Maps each IDE to its display name and output file for `oac apply`. */
const IDE_DISPLAY_NAMES: Record<IdeType, string> = {
  opencode: "OpenCode",
  cursor: "Cursor",
  claude: "Claude",
  windsurf: "Windsurf",
};

/** Output file/directory written by `oac apply` for each IDE. */
const IDE_OUTPUT_FILES: Record<IdeType, string> = {
  opencode: ".opencode/",
  cursor: ".cursorrules",
  claude: "CLAUDE.md",
  windsurf: ".windsurfrules",
};

// ─── Detection Logic ──────────────────────────────────────────────────────────

/** Returns the indicator string and detected status for a single IDE. */
async function checkIde(
  projectRoot: string,
  ide: IdeType
): Promise<{ detected: boolean; indicator: string }> {
  if (ide === "opencode") {
    const p = path.join(projectRoot, ".opencode");
    return (await Bun.file(p).exists())
      ? { detected: true, indicator: ".opencode/ directory" }
      : { detected: false, indicator: ".opencode/ directory (not found)" };
  }
  if (ide === "cursor") {
    const p = path.join(projectRoot, ".cursor");
    return (await Bun.file(p).exists())
      ? { detected: true, indicator: ".cursor/ directory" }
      : { detected: false, indicator: ".cursor/ directory (not found)" };
  }
  if (ide === "claude") {
    const dir = path.join(projectRoot, ".claude");
    const file = path.join(projectRoot, "CLAUDE.md");
    if (await Bun.file(dir).exists()) return { detected: true, indicator: ".claude/ directory" };
    if (await Bun.file(file).exists()) return { detected: true, indicator: "CLAUDE.md file" };
    return { detected: false, indicator: ".claude/ directory or CLAUDE.md (not found)" };
  }
  // windsurf
  const p = path.join(projectRoot, ".windsurf");
  return (await Bun.file(p).exists())
    ? { detected: true, indicator: ".windsurf/ directory" }
    : { detected: false, indicator: ".windsurf/ directory (not found)" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Detects a single IDE in the given project root. */
export async function detectIde(
  projectRoot: string,
  ide: IdeType
): Promise<DetectedIde> {
  const { detected, indicator } = await checkIde(projectRoot, ide);
  return { type: ide, detected, indicator };
}

/** Detects all supported IDEs in the given project root. */
export async function detectIdes(projectRoot: string): Promise<DetectedIde[]> {
  const ides: IdeType[] = ["opencode", "cursor", "claude", "windsurf"];
  return Promise.all(ides.map((ide) => detectIde(projectRoot, ide)));
}

/** Returns true if the given IDE is present in the project root. */
export async function isIdePresent(
  projectRoot: string,
  ide: IdeType
): Promise<boolean> {
  const result = await detectIde(projectRoot, ide);
  return result.detected;
}

/** Returns the output file path (relative) written by `oac apply` for an IDE. */
export function getIdeOutputFile(ide: IdeType): string {
  return IDE_OUTPUT_FILES[ide];
}

/** Returns the human-readable display name for an IDE. */
export function getIdeDisplayName(ide: IdeType): string {
  return IDE_DISPLAY_NAMES[ide];
}

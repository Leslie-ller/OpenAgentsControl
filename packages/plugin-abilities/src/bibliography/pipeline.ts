/**
 * BibliographyPipeline — Orchestrates multi-stage bibliography workflow execution.
 *
 * This class sits above the executor and BibliographyStore, providing:
 *
 * 1. **Stage execution** — runs a single bibliography stage through the executor,
 *    capturing the output and persisting it as a typed artifact.
 *
 * 2. **Inter-stage data flow** — when running a stage, automatically loads
 *    relevant prior-stage artifacts and injects them via `stageOutputs` on
 *    the ExecutorContext so steps can reference them via interpolation.
 *
 * 3. **Pipeline status** — delegates to BibliographyStore.getPipelineStatus()
 *    for a complete picture of what's been processed.
 *
 * Design:
 * - The pipeline does NOT modify the core executor — it wraps it.
 * - Artifact parsing is best-effort: if step output is valid JSON it's stored
 *   as structured data, otherwise as `{ raw: string }`.
 * - Each stage maps to a specific ability name + artifact type.
 */

import type { Ability, AbilityExecution, ExecutorContext, InputValues } from '../types/index.js'
import { executeAbility } from '../executor/index.js'
import type { ExecuteAbilityOptions } from '../executor/index.js'
import { BibliographyStore } from './store.js'
import type { ArtifactType, Artifact } from './store.js'

// ─── Stage → Artifact mapping ──────────────────────────────

export interface StageConfig {
  /** The ability name to execute */
  abilityName: string
  /** What artifact type the output maps to */
  artifactType: ArtifactType
  /** How to derive the artifact key from inputs */
  keyFrom: string
  /** Which prior-stage artifact types to inject as stageOutputs */
  dependsOn: ArtifactType[]
}

export const STAGE_CONFIGS: Record<string, StageConfig> = {
  plan: {
    abilityName: 'research/bibliography-plan',
    artifactType: 'plan',
    keyFrom: 'topic',
    dependsOn: [],
  },
  screening: {
    abilityName: 'research/paper-screening',
    artifactType: 'screening',
    keyFrom: 'query',
    dependsOn: ['plan'],
  },
  review: {
    abilityName: 'research/paper-fulltext-review',
    artifactType: 'reading-card',
    keyFrom: 'zotero_key',
    dependsOn: ['screening'],
  },
  decision: {
    abilityName: 'research/literature-decision',
    artifactType: 'decision',
    keyFrom: 'paper_key',
    dependsOn: ['reading-card'],
  },
  'evidence-pack': {
    abilityName: 'research/section-evidence-pack',
    artifactType: 'evidence-pack',
    keyFrom: 'section',
    dependsOn: ['decision'],
  },
  audit: {
    abilityName: 'research/citation-audit',
    artifactType: 'audit',
    keyFrom: 'section',
    dependsOn: ['evidence-pack'],
  },
}

// ─── Pipeline ──────────────────────────────────────────────

export interface PipelineOptions {
  /** Executor options (eventBus, etc.) */
  executorOptions?: ExecuteAbilityOptions
}

export interface StageResult {
  stage: string
  execution: AbilityExecution
  artifact: Artifact | null
  artifacts: Artifact[]
  artifactKey: string
}

export interface StageCommandResult {
  stage: string
  execution: {
    id: string
    status: AbilityExecution['status']
    control?: AbilityExecution['control']
    error?: string
    failedStepId?: string
  }
  artifact: {
    key: string
    batchKey?: string
    meta: Artifact['meta'] | null
    data: Artifact['data'] | null
    artifacts: Array<{
      key: string
      meta: Artifact['meta']
      data: Artifact['data']
    }>
  }
}

export class BibliographyPipeline {
  private store: BibliographyStore

  constructor(store: BibliographyStore) {
    this.store = store
  }

  getStore(): BibliographyStore {
    return this.store
  }

  /**
   * Run a single stage of the bibliography pipeline.
   *
   * 1. Loads prior-stage artifacts relevant to this stage's inputs.
   * 2. Executes the ability through the standard executor.
   * 3. Parses the final step output and saves it as a typed artifact.
   */
  async runStage(
    stage: string,
    ability: Ability,
    inputs: InputValues,
    ctx: ExecutorContext,
    options?: PipelineOptions
  ): Promise<StageResult> {
    const config = STAGE_CONFIGS[stage]
    if (!config) {
      throw new Error(`Unknown bibliography stage: '${stage}'`)
    }

    // Derive artifact key from inputs
    const rawKey = String(inputs[config.keyFrom] ?? stage)
    const artifactKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase()

    // Load prior-stage artifacts into stageOutputs
    const stageOutputs: Record<string, unknown> = { ...ctx.stageOutputs }
    for (const depType of config.dependsOn) {
      const artifacts = await this.store.listAll(depType)
      stageOutputs[depType] = filterDependencyArtifacts(stage, depType, artifacts, inputs)
        .map((artifact) => artifact.data)
    }

    // Build enriched context
    const enrichedCtx: ExecutorContext = {
      ...ctx,
      stageOutputs,
    }

    // Execute the ability
    const execution = await executeAbility(
      ability,
      inputs,
      enrichedCtx,
      options?.executorOptions
    )

    // Persist artifact from the last successful step's output
    let artifact: Artifact | null = null
    let artifacts: Artifact[] = []
    if (execution.status === 'completed') {
      // Find the last completed (non-skipped, non-failed) step with output
      const successSteps = execution.completedSteps.filter(
        s => s.status === 'completed' && s.output
      )
      const lastStep = successSteps[successSteps.length - 1]

      if (lastStep?.output) {
        const parsed = tryParseJSON(lastStep.output.trim())
        if (config.artifactType === 'screening') {
          const screeningItems = extractScreeningItems(parsed)
          if (screeningItems.length > 0) {
            artifacts = await this.store.saveScreeningBatch(screeningItems, {
              executionId: execution.id,
              sourceStage: stage,
            })
            artifact = artifacts[0] ?? null
          } else {
            artifact = await this.store.save(
              config.artifactType,
              artifactKey,
              parsed,
              {
                executionId: execution.id,
                sourceStage: stage,
              }
            )
            artifacts = artifact ? [artifact] : []
          }
        } else {
          artifact = await this.store.save(
            config.artifactType,
            artifactKey,
            parsed,
            {
              executionId: execution.id,
              sourceStage: stage,
            }
          )
          artifacts = artifact ? [artifact] : []
        }
      }
    }

    return { stage, execution, artifact, artifacts, artifactKey }
  }

  async runStageCommand(
    stage: string,
    ability: Ability,
    inputs: InputValues,
    ctx: ExecutorContext,
    options?: PipelineOptions
  ): Promise<StageCommandResult> {
    const result = await this.runStage(stage, ability, inputs, ctx, options)
    const failedStep = [...result.execution.completedSteps].reverse().find((step) => step.status === 'failed')
    const executionError = result.execution.error ?? failedStep?.error
    return {
      stage: result.stage,
      execution: {
        id: result.execution.id,
        status: result.execution.status,
        control: result.execution.control,
        error: executionError,
        failedStepId: failedStep?.stepId,
      },
      artifact: {
        key: result.artifact?.meta.key ?? result.artifactKey,
        batchKey: result.artifact?.meta.key && result.artifact.meta.key !== result.artifactKey
          ? result.artifactKey
          : undefined,
        meta: result.artifact?.meta ?? null,
        data: result.artifact?.data ?? null,
        artifacts: result.artifacts.map((artifact) => ({
          key: artifact.meta.key,
          meta: artifact.meta,
          data: artifact.data,
        })),
      },
    }
  }

  /**
   * Get the current pipeline status.
   */
  async getStatus() {
    return this.store.getPipelineStatus()
  }

  /**
   * Get the review queue (papers screened as 'keep' but not yet reviewed).
   */
  async getReviewQueue() {
    return this.store.getReviewQueue()
  }

  /**
   * Get the decision queue (papers reviewed but not yet decided).
   */
  async getDecisionQueue() {
    return this.store.getDecisionQueue()
  }
}

// ─── Helpers ───────────────────────────────────────────────

function tryParseJSON(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    // If it's an array or primitive, wrap it
    return { value: parsed }
  } catch {
    // Not JSON — store as raw text
    return { raw: text }
  }
}

function extractScreeningItems(parsed: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates: unknown[] = []

  if (Array.isArray(parsed.items)) candidates.push(...parsed.items)
  if (Array.isArray(parsed.papers)) candidates.push(...parsed.papers)
  if (Array.isArray(parsed.screening_items)) candidates.push(...parsed.screening_items)
  if (Array.isArray(parsed.decisions)) candidates.push(...parsed.decisions)

  if (candidates.length === 0 && typeof parsed.paper_key === 'string') {
    return [parsed]
  }

  return candidates.filter((item): item is Record<string, unknown> => {
    return Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  })
}

function filterDependencyArtifacts(
  stage: string,
  depType: ArtifactType,
  artifacts: Artifact[],
  inputs: InputValues
): Artifact[] {
  const scopedPaperKeys = normalizeStringArray(inputs.paper_keys)
  switch (`${stage}:${depType}`) {
    case 'screening:plan': {
      const query = normalizeString(inputs.query)
      if (!query) return []
      return artifacts.filter((artifact) => {
        const data = toRecord(artifact.data)
        const topic = normalizeString(data.topic)
        const queries = Array.isArray(data.queries)
          ? data.queries.filter((value): value is string => typeof value === 'string').map(normalizeString)
          : []
        return topic === query || queries.includes(query)
      })
    }
    case 'review:screening': {
      const paperKey = normalizeString(inputs.zotero_key ?? inputs.paper_key)
      if (!paperKey) return []
      return artifacts.filter((artifact) => normalizeString(toRecord(artifact.data).paper_key) === paperKey)
    }
    case 'decision:reading-card': {
      const paperKey = normalizeString(inputs.paper_key ?? inputs.zotero_key)
      if (!paperKey) return []
      return artifacts.filter((artifact) => normalizeString(toRecord(artifact.data).paper_key) === paperKey)
    }
    case 'evidence-pack:decision': {
      const section = normalizeString(inputs.section)
      if (!section) return []
      return artifacts.filter((artifact) => {
        const data = toRecord(artifact.data)
        const sections = Array.isArray(data.sections_relevant)
          ? data.sections_relevant.filter((value): value is string => typeof value === 'string').map(normalizeString)
          : []
        if (!sections.includes(section)) return false
        if (scopedPaperKeys.length === 0) return true
        const paperKey = normalizeString(data.paper_key)
        return scopedPaperKeys.includes(paperKey)
      })
    }
    case 'audit:evidence-pack': {
      const section = normalizeString(inputs.section)
      if (!section) return []
      return artifacts.filter((artifact) => {
        const data = toRecord(artifact.data)
        if (normalizeString(data.section) !== section) return false
        if (scopedPaperKeys.length === 0) return true
        const selectedKeys = normalizeStringArray(data.selected_paper_keys)
        if (selectedKeys.length === 0) return false
        return arraysMatch(selectedKeys, scopedPaperKeys)
      })
    }
    default:
      return artifacts
  }
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeString)
    .filter(Boolean)
}

function arraysMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function createBibliographyPipeline(store: BibliographyStore): BibliographyPipeline {
  return new BibliographyPipeline(store)
}

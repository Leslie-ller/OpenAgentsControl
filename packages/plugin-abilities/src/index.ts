/**
 * @openagents/plugin-abilities - Minimal Version
 * 
 * Enforced, validated workflows for OpenCode agents.
 * Stripped to essentials for testing core concept.
 */

// Core types
export type {
  Ability,
  Step,
  ScriptStep,
  AgentStep,
  InputDefinition,
  InputValues,
  AbilityExecution,
  StepResult,
  ExecutorContext,
  AgentCallOptions,
  AgentCallReturn,
  AgentContext,
  LoadedAbility,
  ValidationResult,
  ControlResult,
  GateResult,
  NamedGateResult,
  GateVerdict,
  GateName,
  ObligationResult,
  ObligationKey,
  ObligationSeverity,
  ObligationStatus,
  ObligationDefinition,
  TaskType,
  DriftPolicy,
  ModelDriftEntry,
  ModelAuditResult,
  PermissionValidatorInterface,
  AgentPermissionsData,
} from './types/index.js'

// Loader
export { loadAbilities, loadAbility } from './loader/index.js'

// Validator
export { validateAbility, validateInputs } from './validator/index.js'
export { PermissionValidator } from './validator/permissions.js'
export type { PermissionValidationResult, StepPermissionResult } from './validator/permissions.js'

// Context Discovery
export { ContextDiscovery } from './context/discovery.js'
export type { ContextDefinition, LoadedContext, AgentPermissions } from './context/types.js'

// Executor
export { executeAbility, formatExecutionResult } from './executor/index.js'
export type { ExecuteAbilityOptions } from './executor/index.js'
export { ExecutionManager } from './executor/execution-manager.js'

// Control - Obligations & Gates
export { evaluateControl, evaluateControlFromEvents } from './control/index.js'

// Control - Obligation Registry
export { ObligationRegistry, defaultRegistry, resolveObligations, getBuiltinObligations } from './control/obligation-registry.js'

// Control - Model Drift Audit
export { evaluateModelDrift, hasModelDrift } from './control/model-audit.js'

// Control - Event Model
export { ControlEventFactory, generateEventId } from './control/events.js'
export type {
  ControlEvent,
  ControlEventType,
  ControlEventPayload,
  Actor,
  ActorKind,
  EventContext,
  EventFactoryOptions,
  RunStartedPayload,
  RunCompletedPayload,
  StepStartedPayload,
  StepCompletedPayload,
  ToolCalledPayload,
  ValidationResultPayload,
  ObligationSignalPayload,
  EvidenceStatsPayload,
  ModelObservedPayload,
} from './control/events.js'

// Control - Event Bus
export { ControlEventBus } from './control/event-bus.js'
export type { EventSubscriber, EventBusOptions } from './control/event-bus.js'

// Control - Event Log
export { EventLog } from './control/event-log.js'
export type { EventLogOptions } from './control/event-log.js'

// Bibliography Store
export { BibliographyStore, createBibliographyStore } from './bibliography/store.js'
export type {
  ArtifactType,
  ArtifactMeta,
  Artifact,
  PlanData,
  ScreeningData,
  ReadingCardData,
  DecisionData,
  EvidencePackData,
  AuditData,
  BibliographyStoreOptions,
} from './bibliography/store.js'

// Bibliography Pipeline
export { BibliographyPipeline, createBibliographyPipeline, STAGE_CONFIGS } from './bibliography/pipeline.js'
export type { StageConfig, PipelineOptions, StageResult, StageCommandResult } from './bibliography/pipeline.js'

// Bibliography Audit Scan
export { scanBibliographyArtifacts } from './bibliography/audit-scan.js'
export type { AuditFinding, AuditScanResult, AuditFindingSeverity } from './bibliography/audit-scan.js'

// Coding Artifacts & Gates
export { CodingArtifactStore, createCodingArtifactStore } from './coding/artifact-store.js'
export type {
  CodingArtifactType,
  CodingArtifactMeta,
  CodingArtifact,
  CodingArtifactStoreOptions,
  TaskPlanData,
  SubtaskRecordData,
  ImplementationResultData,
  ValidationReportData,
  ReviewReportData,
  CompletionSummaryData,
} from './coding/artifact-store.js'
export { evaluateCodeChangeGates } from './coding/gates.js'
export { deriveCompletionSummary } from './coding/completion-summary.js'
export { writeTaskBreakdownArtifacts } from './coding/task-breakdown-bridge.js'
export type { TaskBreakdownBridgeOptions } from './coding/task-breakdown-bridge.js'

// Runtime Context Checkpoint MVP
export { resolveTopicFromExecution } from './runtime/context/topic-resolver.js'
export { CheckpointStore, createCheckpointStore } from './runtime/context/checkpoint-store.js'
export { renderFocusRefreshBlock } from './runtime/context/focus-refresh.js'
export { createCompactionCheckpoint } from './runtime/context/compaction-checkpoint.js'
export { selectDetailFields } from './runtime/context/detail-reinjector.js'
export { renderDetailReinjectionBlock } from './runtime/context/detail-reinjector.js'
export { PendingCheckpointSummaries } from './runtime/context/pending-checkpoint-summaries.js'
export type {
  StateCapsule,
  DetailCapsule,
  DetailUseCase,
} from './runtime/context/types.js'

// Plugin
export { AbilitiesPlugin } from './opencode-plugin.js'
export { default } from './opencode-plugin.js'

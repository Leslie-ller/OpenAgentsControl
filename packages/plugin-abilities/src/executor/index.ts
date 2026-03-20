import { spawn } from 'child_process'
import type {
  Ability,
  Step,
  ScriptStep,
  AgentStep,
  SkillStep,
  ApprovalStep,
  WorkflowStep,
  AbilityExecution,
  StepResult,
  ExecutorContext,
  InputValues,
} from '../types/index.js'
import { validateInputs } from '../validator/index.js'
import { evaluateControl, evaluateControlFromEvents } from '../control/index.js'
import type { ControlEventBus } from '../control/event-bus.js'
import { ControlEventFactory } from '../control/events.js'
import { hasModelDrift } from '../control/model-audit.js'
import { deriveCompletionSummary } from '../coding/completion-summary.js'

/**
 * Minimal Executor - Script Steps Only
 * 
 * Now instrumented with the Control Event Model:
 * - Emits structured events to ControlEventBus when provided
 * - Obligation evaluation can use event stream instead of step tags
 * - All existing behavior preserved when no bus is provided
 */

function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Parse a human-readable timeout string into milliseconds.
 * Supported formats: "30s", "5m", "1h", "500ms", "2m30s", or plain number (treated as ms).
 */
export function parseTimeout(timeout: string | undefined): number | undefined {
  if (!timeout) return undefined
  // Plain number → treat as milliseconds
  if (/^\d+$/.test(timeout)) return parseInt(timeout, 10)

  let totalMs = 0
  const hourMatch = timeout.match(/(\d+)h/)
  const minMatch = timeout.match(/(\d+)m(?!s)/)
  const secMatch = timeout.match(/(\d+)s/)
  const msMatch = timeout.match(/(\d+)ms/)

  if (hourMatch) totalMs += parseInt(hourMatch[1], 10) * 3600000
  if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60000
  if (secMatch) totalMs += parseInt(secMatch[1], 10) * 1000
  if (msMatch) totalMs += parseInt(msMatch[1], 10)

  return totalMs > 0 ? totalMs : undefined
}

/**
 * Wrap a promise with a timeout. Rejects with a TimeoutError if the timeout expires.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stepId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step '${stepId}' timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

function interpolateVariables(text: string, inputs: InputValues, completedSteps?: StepResult[]): string {
  if (!text) return text
  let result = text.replace(/\{\{inputs\.(\w+)\}\}/g, (match, name) => {
    const value = inputs[name]
    return value !== undefined ? String(value) : match
  })
  if (completedSteps) {
    result = result.replace(/\{\{steps\.(\w+)\.output\}\}/g, (match, stepId) => {
      const step = completedSteps.find(s => s.stepId === stepId)
      return step?.output !== undefined ? step.output.trim() : match
    })
  }
  return result
}

function truncateForContext(value: string, maxLength = 50000): string {
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

function buildScriptContextEnv(
  execution: AbilityExecution,
  ctx: ExecutorContext
): Record<string, string> {
  const stepOutputs = Object.fromEntries(
    execution.completedSteps.map((step) => [
      step.stepId,
      {
        status: step.status,
        output: typeof step.output === 'string' ? truncateForContext(step.output) : step.output,
        error: step.error,
        tags: step.tags,
      },
    ])
  )

  return {
    ABILITY_INPUTS_JSON: JSON.stringify(execution.inputs),
    ABILITY_STAGE_OUTPUTS_JSON: JSON.stringify(ctx.stageOutputs ?? {}),
    ABILITY_STEP_OUTPUTS_JSON: JSON.stringify(stepOutputs),
  }
}

async function runScript(
  command: string,
  options: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', command], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 })
    })

    proc.on('error', (error) => {
      resolve({ stdout, stderr: error.message, exitCode: 1 })
    })
  })
}

async function executeScriptStep(
  step: ScriptStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  const command = interpolateVariables(step.run, execution.inputs, execution.completedSteps)

  console.log(`[abilities] Executing: ${command}`)

  try {
    const result = await runScript(command, {
      cwd: step.cwd || ctx.cwd,
      env: {
        ...ctx.env,
        ...buildScriptContextEnv(execution, ctx),
        ...step.env,
      },
    })

    // Validate exit code if specified
    let failed = false
    let error: string | undefined

    if (step.validation?.exit_code !== undefined && result.exitCode !== step.validation.exit_code) {
      failed = true
      error = `Exit code ${result.exitCode}, expected ${step.validation.exit_code}`
    } else if (result.exitCode !== 0) {
      failed = true
      error = result.stderr.trim() || result.stdout.trim() || `Exit code ${result.exitCode}`
    }

    return {
      stepId: step.id,
      status: failed ? 'failed' : 'completed',
      tags: step.tags,
      output: result.stdout || result.stderr,
      error,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

/**
 * Result from ctx.agents.call — can be a plain string or structured with model info.
 */
interface AgentCallResult {
  output: string
  model?: string
  provider?: string
}

function normalizeAgentResult(raw: string | AgentCallResult): AgentCallResult {
  if (typeof raw === 'string') {
    return { output: raw }
  }
  return raw
}

async function executeAgentStep(
  step: AgentStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  // Check if agent context is available
  if (!ctx.agents?.call) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: 'Agent execution not available in current context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  let prompt = interpolateVariables(step.prompt, execution.inputs, execution.completedSteps)

  // Append prior step outputs as context when this step has dependencies
  if (step.needs && step.needs.length > 0) {
    const contextParts: string[] = []
    for (const depId of step.needs) {
      const depResult = execution.completedSteps.find(s => s.stepId === depId)
      if (depResult?.output) {
        const output = depResult.output.trim()
        if (output) {
          // Check if prior step had summarize flag; if so, provide a summary
          const depStep = execution.ability.steps.find(s => s.id === depId) as AgentStep | undefined
          if (depStep && 'summarize' in depStep && depStep.summarize) {
            const lines = output.split('\n')
            if (lines.length > 10) {
              const kept = lines.slice(0, 10).join('\n')
              contextParts.push(`[${depId}] Output Summary (${lines.length - 10} lines omitted):\n${kept}`)
            } else {
              contextParts.push(`[${depId}] Output Summary:\n${output}`)
            }
          } else if (output.length > 50000) {
            // Auto-truncate very large outputs
            contextParts.push(`[${depId}] (truncated to 50000 chars):\n${output.slice(0, 50000)}`)
          } else {
            contextParts.push(`[${depId}]:\n${output}`)
          }
        }
      }
    }
    if (contextParts.length > 0) {
      prompt = `${prompt}\n\nContext from prior steps:\n${contextParts.join('\n\n')}`
    }
  }

  const stageOutputs = ctx.stageOutputs ?? {}
  if (Object.keys(stageOutputs).length > 0) {
    const serializedStageOutputs = truncateForContext(
      JSON.stringify(stageOutputs, null, 2)
    )
    prompt = `${prompt}\n\nStage artifacts:\n${serializedStageOutputs}`
  }

  console.log(`[abilities] Agent step: ${step.agent} — ${prompt.slice(0, 80)}`)

  try {
    const raw = await ctx.agents.call({
      agent: step.agent,
      prompt,
      step,
    })

    const result = normalizeAgentResult(raw)

    // Build model audit data for this step
    const modelAudit = (step.model || step.provider || result.model || result.provider)
      ? {
          expectedModel: step.model,
          expectedProvider: step.provider,
          actualModel: result.model,
          actualProvider: result.provider,
        }
      : undefined

    return {
      stepId: step.id,
      status: 'completed',
      tags: step.tags,
      output: result.output,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
      modelAudit,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeSkillStep(
  step: SkillStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.skills?.load) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: 'Skill execution not available in current context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    const output = await ctx.skills.load(step.skill, step.inputs)
    return {
      stepId: step.id,
      status: 'completed',
      tags: step.tags,
      output,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeApprovalStep(
  step: ApprovalStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.approval?.request) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: 'Approval not available in current context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    const prompt = interpolateVariables(step.prompt, execution.inputs, execution.completedSteps)
    const approved = await ctx.approval.request({ prompt, step })
    return {
      stepId: step.id,
      status: approved ? 'completed' : 'failed',
      tags: step.tags,
      output: approved ? 'Approved' : 'Rejected',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeWorkflowStep(
  step: WorkflowStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.abilities) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: 'Workflow execution not available in current context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const childAbility = ctx.abilities.get(step.workflow)
  if (!childAbility) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: `Nested ability '${step.workflow}' not found`,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    // Interpolate workflow inputs
    const workflowInputs: InputValues = {}
    if (step.inputs) {
      for (const [key, value] of Object.entries(step.inputs)) {
        workflowInputs[key] = interpolateVariables(String(value), execution.inputs, execution.completedSteps)
      }
    }

    const childExecution = await ctx.abilities.execute(childAbility, workflowInputs)

    if (childExecution.status === 'completed') {
      return {
        stepId: step.id,
        status: 'completed',
        tags: step.tags,
        output: `Nested workflow '${step.workflow}' completed successfully`,
        startedAt,
        completedAt: Date.now(),
        duration: Date.now() - startedAt,
      }
    } else {
      return {
        stepId: step.id,
        status: 'failed',
        tags: step.tags,
        error: childExecution.error || `Nested workflow '${step.workflow}' failed`,
        startedAt,
        completedAt: Date.now(),
        duration: Date.now() - startedAt,
      }
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

function evaluateCondition(
  condition: string,
  inputs: InputValues,
  completedSteps?: StepResult[]
): boolean {
  const stringMatch = condition.match(/^inputs\.(\w+)\s*(==|!=)\s*"([^"]*)"$/)
  if (stringMatch) {
    const [, name, op, value] = stringMatch
    const actual = String(inputs[name] ?? '')
    if (op === '==') return actual === value
    if (op === '!=') return actual !== value
  }

  const numMatch = condition.match(/^inputs\.(\w+)\s*(>=|<=|>|<|==|!=)\s*(\d+(?:\.\d+)?)$/)
  if (numMatch) {
    const [, name, op, numStr] = numMatch
    const actual = Number(inputs[name])
    const expected = Number(numStr)
    if (Number.isNaN(actual)) return false
    if (op === '>') return actual > expected
    if (op === '>=') return actual >= expected
    if (op === '<') return actual < expected
    if (op === '<=') return actual <= expected
    if (op === '==') return actual === expected
    if (op === '!=') return actual !== expected
  }

  const stepMatch = condition.match(/^steps\.([\w-]+)\.status\s*(==|!=)\s*"([^"]*)"$/)
  if (stepMatch && completedSteps) {
    const [, stepId, op, value] = stepMatch
    const step = completedSteps.find((s) => s.stepId === stepId)
    const actual = step?.status ?? 'pending'
    if (op === '==') return actual === value
    if (op === '!=') return actual !== value
  }

  return Boolean(condition)
}

function buildExecutionOrder(steps: Step[]): Step[] {
  const result: Step[] = []
  const completed = new Set<string>()
  const remaining = [...steps]

  while (remaining.length > 0) {
    const next = remaining.find((step) => {
      if (!step.needs || step.needs.length === 0) return true
      return step.needs.every((dep) => completed.has(dep))
    })

    if (!next) {
      const stuckIds = remaining.map((s) => s.id).join(', ')
      const completedIds = [...completed].join(', ') || 'none'
      throw new Error(
        `[abilities] Circular or unresolvable step dependency detected. ` +
        `Stuck steps: ${stuckIds}. ` +
        `Completed: ${completedIds}`
      )
    }

    result.push(next)
    completed.add(next.id)
    remaining.splice(remaining.indexOf(next), 1)
  }

  return result
}

export interface ExecuteAbilityOptions {
  /** If provided, structured events are emitted for the entire run lifecycle. */
  eventBus?: ControlEventBus
}

/**
 * Run an array of hook commands (shell scripts) sequentially.
 * Returns on first failure. Hooks are best-effort: a hook failure is logged but
 * does not prevent the ability from running — the caller decides how to handle it.
 */
async function runHooks(
  hooks: string[] | undefined,
  ctx: ExecutorContext,
  label: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hooks || hooks.length === 0) return { ok: true }
  for (const cmd of hooks) {
    console.log(`[abilities] Running ${label} hook: ${cmd}`)
    const { exitCode, stderr } = await runScript(cmd, { cwd: ctx.cwd, env: ctx.env })
    if (exitCode !== 0) {
      const error = `${label} hook failed (exit ${exitCode}): ${cmd}${stderr ? ' — ' + stderr.trim() : ''}`
      console.error(`[abilities] ${error}`)
      return { ok: false, error }
    }
  }
  return { ok: true }
}

export async function executeAbility(
  ability: Ability,
  inputs: InputValues,
  ctx: ExecutorContext,
  options?: ExecuteAbilityOptions
): Promise<AbilityExecution> {
  const eventBus = options?.eventBus
  const executionId = generateExecutionId()
  const runId = generateRunId()

  // Create event factory if bus is available
  const eventFactory = eventBus
    ? new ControlEventFactory({
        run_id: runId,
        ability_execution_id: executionId,
      })
    : undefined

  // Validate inputs
  const inputErrors = validateInputs(ability, inputs)
  if (inputErrors.length > 0) {
    const execution: AbilityExecution = {
      id: executionId,
      ability,
      inputs,
      status: 'failed',
      executionStatus: 'failed',
      currentStep: null,
      currentStepIndex: -1,
      completedSteps: [],
      pendingSteps: ability.steps,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: `Input validation failed: ${inputErrors.map((e) => e.message).join(', ')}`,
    }

    // Emit run.failed for input validation failure
    if (eventBus && eventFactory) {
      eventBus.emit(eventFactory.runStarted(ability.name, inputs))
      eventBus.emit(eventFactory.runFailed(ability.name, 0, execution.error))
    }

    return execution
  }

  // Apply defaults
  const resolvedInputs: InputValues = { ...inputs }
  if (ability.inputs) {
    for (const [name, def] of Object.entries(ability.inputs)) {
      if (resolvedInputs[name] === undefined && def.default !== undefined) {
        resolvedInputs[name] = def.default
      }
    }
  }

  // Build execution order based on dependencies
  const orderedSteps = buildExecutionOrder(ability.steps)

  const execution: AbilityExecution = {
    id: executionId,
    ability,
    inputs: resolvedInputs,
    status: 'running',
    executionStatus: 'running',
    currentStep: null,
    currentStepIndex: -1,
    completedSteps: [],
    pendingSteps: [...orderedSteps],
    startedAt: Date.now(),
  }

  // Emit run.started
  if (eventBus && eventFactory) {
    eventBus.emit(eventFactory.runStarted(ability.name, resolvedInputs))
  }

  // Run before hooks
  if (ability.hooks?.before) {
    const hookResult = await runHooks(ability.hooks.before, ctx, 'before')
    if (!hookResult.ok) {
      execution.status = 'failed'
      execution.error = hookResult.error
      execution.completedAt = Date.now()
      if (eventBus && eventFactory) {
        const duration = execution.completedAt - execution.startedAt
        eventBus.emit(eventFactory.runFailed(ability.name, duration, hookResult.error))
      }
      return execution
    }
  }

  // Execute steps sequentially
  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i]
    execution.currentStep = step
    execution.currentStepIndex = i

    console.log(`[abilities] Step ${i + 1}/${orderedSteps.length}: ${step.id}`)

    // Evaluate `when` condition — skip step if condition is false
    if ('when' in step && step.when) {
      const conditionMet = evaluateCondition(step.when, resolvedInputs, execution.completedSteps)
      if (!conditionMet) {
        const skippedResult: StepResult = {
          stepId: step.id,
          status: 'skipped',
          tags: step.tags,
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        }
        execution.completedSteps.push(skippedResult)
        execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)

        if (eventBus && eventFactory) {
          eventBus.emit(eventFactory.stepCompleted(
            ability.name, step.id, step.type, 'skipped', 0,
            { tags: step.tags }
          ))
        }

        // Fire onStepComplete callback
        if (ctx.onStepComplete) ctx.onStepComplete(step, skippedResult, execution)
        continue
      }
    }

    // Emit step.started
    if (eventBus && eventFactory) {
      eventBus.emit(eventFactory.stepStarted(ability.name, step.id, step.type, step.needs))
    }

    // Fire onStepStart callback
    if (ctx.onStepStart) ctx.onStepStart(step)

    // ── Permission check ──────────────────────────────────
    // When a permissionValidator and agentPermissions are both provided,
    // check whether this step is permitted before dispatching.
    if (ctx.permissionValidator && ctx.agentPermissions) {
      const permResult = ctx.permissionValidator.checkStepPermission(step, ctx.agentPermissions)
      if (!permResult.allowed) {
        const permError = permResult.reason || `Permission denied for step '${step.id}'`
        console.log(`[abilities] Permission denied: ${permError}`)

        const deniedResult: StepResult = {
          stepId: step.id,
          status: 'failed',
          tags: step.tags,
          error: permError,
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        }

        execution.completedSteps.push(deniedResult)
        execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)

        // Emit step.failed for permission denial
        if (eventBus && eventFactory) {
          eventBus.emit(eventFactory.stepFailed(
            ability.name, step.id, step.type, 0, permError, step.tags
          ))
        }

        // Fire onStepFail callback
        if (ctx.onStepFail) ctx.onStepFail(step, permError, execution)

        // Respect on_failure policy
        const permFailPolicy = step.on_failure
        if (permFailPolicy === 'continue') {
          continue
        }

        execution.status = 'failed'
        execution.error = permError
        execution.completedAt = Date.now()

        if (eventBus && eventFactory) {
          const duration = execution.completedAt - execution.startedAt
          eventBus.emit(eventFactory.runFailed(ability.name, duration, permError))
        }

        return execution
      }
    }

    // Dispatch to the appropriate step handler (with timeout + retry)
    const stepTimeoutMs = parseTimeout(step.timeout) || parseTimeout(ability.settings?.timeout)
    const maxRetries = step.max_retries ?? 0
    const failPolicy = step.on_failure

    let result: StepResult = {
      stepId: step.id,
      status: 'failed',
      tags: step.tags,
      error: 'Step did not execute',
      startedAt: Date.now(),
      completedAt: Date.now(),
      duration: 0,
    }
    let attempts = 0
    const maxAttempts = failPolicy === 'retry' ? Math.max(maxRetries, 1) + 1 : 1

    while (attempts < maxAttempts) {
      attempts++

      const dispatchStep = async (): Promise<StepResult> => {
        switch (step.type) {
          case 'agent':
            return executeAgentStep(step as AgentStep, execution, ctx)
          case 'skill':
            return executeSkillStep(step as SkillStep, execution, ctx)
          case 'approval':
            return executeApprovalStep(step as ApprovalStep, execution, ctx)
          case 'workflow':
            return executeWorkflowStep(step as WorkflowStep, execution, ctx)
          default:
            return executeScriptStep(step as ScriptStep, execution, ctx)
        }
      }

      try {
        result = stepTimeoutMs
          ? await withTimeout(dispatchStep(), stepTimeoutMs, step.id)
          : await dispatchStep()
      } catch (err) {
        // Timeout or unexpected error
        result = {
          stepId: step.id,
          status: 'failed',
          tags: step.tags,
          error: err instanceof Error ? err.message : String(err),
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        }
      }

      // If succeeded or this is the last attempt, break out
      if (result.status !== 'failed' || attempts >= maxAttempts) break

      // Retry: log and loop
      console.log(`[abilities] Step '${step.id}' failed (attempt ${attempts}/${maxAttempts}), retrying...`)
    }

    execution.completedSteps.push(result)
    execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)

    // Emit step.completed or step.failed
    if (eventBus && eventFactory) {
      if (result.status === 'failed') {
        eventBus.emit(eventFactory.stepFailed(
          ability.name, step.id, step.type, result.duration, result.error, result.tags
        ))
      } else {
        eventBus.emit(eventFactory.stepCompleted(
          ability.name, step.id, step.type, result.status, result.duration,
          { tags: result.tags, output: result.output }
        ))
      }

      // Emit model.observed for agent steps with model audit data
      if (step.type === 'agent' && result.modelAudit) {
        const agentStep = step as AgentStep
        const audit = result.modelAudit
        const drift = hasModelDrift(
          { model: audit.expectedModel, provider: audit.expectedProvider },
          { model: audit.actualModel, provider: audit.actualProvider }
        )
        eventBus.emit(eventFactory.modelObserved(
          ability.name,
          drift,
          'agent_step_dispatch',
          {
            expected_model: audit.expectedModel,
            actual_model: audit.actualModel,
            expected_provider: audit.expectedProvider,
            actual_provider: audit.actualProvider,
          }
        ))
      }

      // Emit validation.result if step has exit code validation
      if ((step as ScriptStep).validation?.exit_code !== undefined) {
        const exitCodeValidation = (step as ScriptStep).validation!
        eventBus.emit(eventFactory.validationResult(
          ability.name,
          step.id,
          'script.exit_code',
          exitCodeValidation.exit_code,
          result.status === 'completed' ? exitCodeValidation.exit_code : 'non-zero',
          result.status === 'completed'
        ))
      }

      // Emit obligation.signal for steps with tags (evidence that an obligation-related action occurred)
      if (result.tags && result.tags.length > 0) {
        for (const tag of result.tags) {
          eventBus.emit(eventFactory.obligationSignal(
            ability.name,
            tag, // the tag itself serves as evidence key
            'step_completed',
            {
              step_id: step.id,
              step_type: step.type,
              status: result.status,
              tag,
            }
          ))
        }
      }

      const evidenceStats = extractEvidenceStats(result.output)
      if (evidenceStats) {
        eventBus.emit(eventFactory.evidenceStats(
          ability.name,
          evidenceStats,
          { step_id: step.id }
        ))
      }
    }

    if (result.status === 'failed') {
      // Fire onStepFail callback
      if (ctx.onStepFail) ctx.onStepFail(step, result.error || 'Unknown error', execution)

      // Check on_failure policy (retry already handled above)
      if (failPolicy === 'continue') {
        // Continue to next step despite failure
        continue
      }

      execution.status = 'failed'
      execution.error = result.error
      execution.completedAt = Date.now()

      // Emit run.failed
      if (eventBus && eventFactory) {
        const duration = execution.completedAt - execution.startedAt
        eventBus.emit(eventFactory.runFailed(ability.name, duration, result.error))
      }

      return execution
    } else {
      // Fire onStepComplete callback
      if (ctx.onStepComplete) ctx.onStepComplete(step, result, execution)
    }
  }

  execution.status = 'completed'
  execution.executionStatus = 'completed'
  execution.currentStep = null
  execution.completedAt = Date.now()

  // Run after hooks (best-effort — failure is recorded but does not block control evaluation)
  if (ability.hooks?.after) {
    const hookResult = await runHooks(ability.hooks.after, ctx, 'after')
    if (!hookResult.ok) {
      console.error(`[abilities] After-hook failed: ${hookResult.error}`)
    }
  }

  // Evaluate control: prefer event-based evaluation when bus is available
  if (eventBus) {
    execution.control = evaluateControlFromEvents(ability, eventBus.getRunEvents(runId))
  } else {
    execution.control = evaluateControl(ability, execution.completedSteps)
  }

  if (execution.control?.gate.verdict === 'block') {
    execution.status = 'failed'
    execution.error = execution.control.gate.reasons.join('; ') || 'Control gate blocked completion'
  }

  // Emit run.completed (with gate verdict)
  if (eventBus && eventFactory) {
    const duration = execution.completedAt - execution.startedAt
    const finalStatus = execution.status === 'completed' ? 'completed' : 'failed'
    eventBus.emit(eventFactory.runCompleted(
      ability.name, finalStatus, duration, execution.control?.gate.verdict
    ))
  }

  return execution
}

function extractEvidenceStats(output: string | undefined): Record<string, unknown> | null {
  if (!output || !output.trim()) return null
  try {
    const parsed = JSON.parse(output.trim())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const payload = parsed as Record<string, unknown>
    const keys = [
      'obligation_key',
      'anchors_count',
      'sufficiency_score',
      'acceptance_criteria',
      'affected_files',
      'changed_files',
      'verdict',
      'blocking_findings',
      'commands',
      'results',
      'exit_codes',
      'subtasks',
      'dependency_graph',
      'dependency_violations',
      'required_fields_present',
      'missing_fields',
      'consistency_ok',
      'capability_ok',
      'claim_scope_ok',
      'grounded_claims',
      'total_claims',
    ]
    const stats: Record<string, unknown> = {}
    for (const key of keys) {
      if (payload[key] !== undefined) {
        stats[key] = payload[key]
      }
    }
    return Object.keys(stats).length > 0 ? stats : null
  } catch {
    return null
  }
}

export function formatExecutionResult(execution: AbilityExecution): string {
  const lines: string[] = []
  const completion = deriveCompletionSummary(execution)

  const statusLine = completion
    ? completion.status === 'completed'
      ? '✅ Complete'
      : completion.status === 'partial'
        ? '⚠️ Partial'
        : '❌ Blocked'
    : execution.status === 'completed'
      ? '✅ Complete'
      : '❌ Failed'

  lines.push(`Ability: ${execution.ability.name}`)
  lines.push(`Status: ${statusLine}`)

  if (execution.error) {
    lines.push(`Error: ${execution.error}`)
  }

  lines.push('')
  lines.push('Steps:')

  for (const result of execution.completedSteps) {
    const icon = result.status === 'completed' ? '✅' : '❌'
    const duration = result.duration ? ` (${(result.duration / 1000).toFixed(1)}s)` : ''
    lines.push(`  ${icon} ${result.stepId}${duration}`)
    if (result.error) {
      lines.push(`     Error: ${result.error}`)
    }
  }

  const totalDuration = execution.completedAt
    ? ((execution.completedAt - execution.startedAt) / 1000).toFixed(1)
    : 'N/A'
  lines.push('')
  lines.push(`Duration: ${totalDuration}s`)

  if (completion) {
    const statusLabel = completion.status === 'completed'
      ? 'completed'
      : completion.status === 'partial'
        ? 'partial'
        : 'blocked'
    lines.push('')
    lines.push('Completion Summary:')
    lines.push(`  Status: ${statusLabel}`)
    lines.push(`  Validated: ${completion.validated ? 'yes' : 'no'}`)
    lines.push(`  Reviewed: ${completion.reviewed ? 'yes' : 'no'}`)
    if (completion.remaining_risks.length > 0) {
      lines.push(`  Remaining risks: ${completion.remaining_risks.join('; ')}`)
    }
    if (completion.next_actions.length > 0) {
      lines.push(`  Next actions: ${completion.next_actions.join('; ')}`)
    }
  }

  return lines.join('\n')
}

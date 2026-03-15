import { spawn } from 'child_process'
import type {
  Ability,
  AgentStep,
  ApprovalStep,
  AbilityExecution,
  InputValues,
  ExecutorContext,
  ScriptStep,
  SkillStep,
  Step,
  StepResult,
  WorkflowStep,
} from '../types/index.js'
import { validateInputs } from '../validator/index.js'

function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildStepOutputMap(execution: AbilityExecution): Record<string, string> {
  const outputs: Record<string, string> = {}
  for (const step of execution.completedSteps) {
    if (typeof step.output === 'string') {
      outputs[step.stepId] = step.output
    }
  }
  return outputs
}

function truncateForPrompt(output: string, maxLength = 4000): string {
  if (output.length <= maxLength) {
    return output
  }

  const omitted = output.length - maxLength
  return `${output.slice(0, maxLength)}\n\n[truncated ${omitted} characters]`
}

function summarizeOutput(output: string): string {
  const lines = output.split('\n').filter(Boolean)
  const preview = lines.slice(0, 5).join('\n')
  const omitted = Math.max(lines.length - 5, 0)

  return [
    'Output Summary:',
    preview,
    omitted > 0 ? `... ${omitted} lines omitted ...` : 'No lines omitted.',
  ].join('\n')
}

function parseTimeoutToMs(timeout: string | undefined): number | null {
  if (!timeout) return null

  const match = timeout.trim().match(/^(\d+)(ms|s|m|h)$/)
  if (!match) return null

  const value = Number(match[1])
  const unit = match[2]

  switch (unit) {
    case 'ms':
      return value
    case 's':
      return value * 1000
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    default:
      return null
  }
}

function normalizeAgentResponse(
  response: string | { output: string; model?: string; provider?: string }
): { output: string; model?: string; provider?: string } {
  if (typeof response === 'string') {
    return { output: response }
  }

  return response
}

function interpolateVariables(
  text: string,
  inputs: InputValues,
  stepOutputs: Record<string, string> = {}
): string {
  return text
    .replace(/\{\{inputs\.(\w+)\}\}/g, (match, name) => {
      const value = inputs[name]
      return value !== undefined ? String(value) : match
    })
    .replace(/\{\{steps\.([\w-]+)\.output\}\}/g, (match, stepId) => {
      const value = stepOutputs[stepId]
      return value !== undefined ? String(value) : match
    })
}

function evaluateCondition(
  expression: string | undefined,
  inputs: InputValues,
  stepOutputs: Record<string, string>
): boolean {
  if (!expression) return true

  const equalsMatch = expression.match(/^inputs\.(\w+)\s*==\s*"([^"]*)"$/)
  if (equalsMatch) {
    return String(inputs[equalsMatch[1]] ?? '') === equalsMatch[2]
  }

  const notEqualsMatch = expression.match(/^inputs\.(\w+)\s*!=\s*"([^"]*)"$/)
  if (notEqualsMatch) {
    return String(inputs[notEqualsMatch[1]] ?? '') !== notEqualsMatch[2]
  }

  const interpolated = interpolateVariables(expression, inputs, stepOutputs)
  return ['true', '1', 'yes'].includes(interpolated.trim().toLowerCase())
}

async function runScript(
  command: string,
  options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', command], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    const timeoutHandle = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          proc.kill('SIGTERM')
        }, options.timeoutMs)
      : null

    const finish = (result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean }) => {
      if (settled) return
      settled = true
      if (timeoutHandle) clearTimeout(timeoutHandle)
      resolve(result)
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      finish({ stdout, stderr, exitCode: code ?? 1, timedOut })
    })

    proc.on('error', (error) => {
      finish({ stdout, stderr: error.message, exitCode: 1, timedOut })
    })
  })
}

function createSkippedResult(step: Step, startedAt: number): StepResult {
  const completedAt = Date.now()
  return {
    stepId: step.id,
    stepType: step.type,
    status: 'skipped',
    output: 'Skipped: condition not met',
    startedAt,
    completedAt,
    duration: completedAt - startedAt,
  }
}

function buildPriorStepContext(step: Step, execution: AbilityExecution): string {
  const priorOutputs = execution.completedSteps
    .filter((result) => !step.needs || step.needs.includes(result.stepId))
    .filter((result) => result.status === 'completed' && typeof result.output === 'string')

  if (priorOutputs.length === 0) {
    return ''
  }

  const lines = ['Context from prior steps:']
  for (const result of priorOutputs) {
    lines.push(`- ${result.stepId}:`)
    lines.push(truncateForPrompt(result.output ?? ''))
  }
  return lines.join('\n')
}

async function executeScriptStep(
  step: ScriptStep,
  execution: AbilityExecution,
  ctx: ExecutorContext,
  timeoutMs?: number | null
): Promise<StepResult> {
  const startedAt = Date.now()
  const command = interpolateVariables(step.run, execution.inputs, buildStepOutputMap(execution))

  console.log(`[abilities] Executing: ${command}`)

  try {
    const result = await runScript(command, {
      cwd: step.cwd || ctx.cwd,
      env: { ...ctx.env, ...step.env },
      timeoutMs: timeoutMs ?? undefined,
    })

    let failed = false
    let error: string | undefined

    if (result.timedOut) {
      failed = true
      error = `Step timed out after ${step.timeout ?? `${timeoutMs}ms`}`
    }

    if (!result.timedOut && step.validation?.exit_code !== undefined && result.exitCode !== step.validation.exit_code) {
      failed = true
      error = `Exit code ${result.exitCode}, expected ${step.validation.exit_code}`
    }

    return {
      stepId: step.id,
      stepType: step.type,
      status: failed ? 'failed' : 'completed',
      output: result.stdout || result.stderr,
      error,
      command,
      validation: step.validation?.exit_code !== undefined
        ? {
            expectedExitCode: step.validation.exit_code,
            actualExitCode: result.exitCode,
            passed: result.exitCode === step.validation.exit_code,
          }
        : undefined,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      command,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeAgentStep(
  step: AgentStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.agents) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: 'Agent execution not available',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const stepOutputs = buildStepOutputMap(execution)
  const prompt = interpolateVariables(step.prompt, execution.inputs, stepOutputs)
  const priorContext = buildPriorStepContext(step, execution)
  const fullPrompt = priorContext ? `${prompt}\n\n${priorContext}` : prompt

  try {
    const response = await ctx.agents.call({
      agent: step.agent,
      prompt: fullPrompt,
      model: step.model,
      provider: step.provider,
    })
    const normalized = normalizeAgentResponse(response)
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'completed',
      output: step.summarize ? summarizeOutput(normalized.output) : normalized.output,
      modelAudit: {
        expectedModel: step.model,
        expectedProvider: step.provider,
        actualModel: normalized.model,
        actualProvider: normalized.provider,
      },
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeSkillStep(
  step: SkillStep,
  _execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.skills) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: 'Skill execution not available',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    const output = await ctx.skills.load(step.skill)
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'completed',
      output,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
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

  if (!ctx.approval) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: 'Approval not available',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const prompt = interpolateVariables(step.prompt, execution.inputs, buildStepOutputMap(execution))
  const approved = await ctx.approval.request({
    prompt,
    options: step.options?.map((option) => option.value),
  })

  return {
    stepId: step.id,
    stepType: step.type,
    status: approved ? 'completed' : 'failed',
    output: approved ? 'Approved' : 'Rejected',
    error: approved ? undefined : 'Approval rejected',
    startedAt,
    completedAt: Date.now(),
    duration: Date.now() - startedAt,
  }
}

function interpolateWorkflowInputs(
  rawInputs: Record<string, unknown> | undefined,
  execution: AbilityExecution
): Record<string, unknown> {
  const stepOutputs = buildStepOutputMap(execution)
  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rawInputs ?? {})) {
    if (typeof value === 'string') {
      resolved[key] = interpolateVariables(value, execution.inputs, stepOutputs)
    } else {
      resolved[key] = value
    }
  }

  return resolved
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
      stepType: step.type,
      status: 'failed',
      error: 'Nested workflow execution not available',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const nested = ctx.abilities.get(step.workflow)
  if (!nested) {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: `Nested workflow '${step.workflow}' not found`,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const nestedInputs = interpolateWorkflowInputs(step.inputs, execution)
  const nestedExecution = await ctx.abilities.execute(nested, nestedInputs)

  if (nestedExecution.status !== 'completed') {
    return {
      stepId: step.id,
      stepType: step.type,
      status: 'failed',
      error: nestedExecution.error ?? `Nested workflow '${step.workflow}' failed`,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  return {
    stepId: step.id,
    stepType: step.type,
    status: 'completed',
    output: `Nested workflow '${step.workflow}' completed successfully`,
    startedAt,
    completedAt: Date.now(),
    duration: Date.now() - startedAt,
  }
}

async function withTimeout(
  step: Step,
  run: () => Promise<StepResult>,
  timeoutMs: number | null
): Promise<StepResult> {
  if (!timeoutMs) {
    return run()
  }

  const startedAt = Date.now()

  return new Promise<StepResult>((resolve) => {
    let settled = false
    const timeoutHandle = setTimeout(() => {
      if (settled) return
      settled = true
      const completedAt = Date.now()
      resolve({
        stepId: step.id,
        stepType: step.type,
        status: 'failed',
        error: `Step timed out after ${step.timeout ?? `${timeoutMs}ms`}`,
        startedAt,
        completedAt,
        duration: completedAt - startedAt,
      })
    }, timeoutMs)

    run().then((result) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      resolve(result)
    })
  })
}

async function executeStep(
  step: Step,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const timeoutMs = parseTimeoutToMs(step.timeout)

  switch (step.type) {
    case 'script':
      return executeScriptStep(step, execution, ctx, timeoutMs)
    case 'agent':
      return withTimeout(step, () => executeAgentStep(step, execution, ctx), timeoutMs)
    case 'skill':
      return withTimeout(step, () => executeSkillStep(step, execution, ctx), timeoutMs)
    case 'approval':
      return withTimeout(step, () => executeApprovalStep(step, execution, ctx), timeoutMs)
    case 'workflow':
      return withTimeout(step, () => executeWorkflowStep(step, execution, ctx), timeoutMs)
    default: {
      const startedAt = Date.now()
      const unknownStep = step as { id?: string; type?: string }
      return {
        stepId: unknownStep.id ?? 'unknown-step',
        stepType: unknownStep.type as Step['type'] | undefined,
        status: 'failed',
        error: `Unsupported step type: ${unknownStep.type ?? 'unknown'}`,
        startedAt,
        completedAt: Date.now(),
        duration: Date.now() - startedAt,
      }
    }
  }
}

async function executeStepWithPolicy(
  step: Step,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const maxAttempts = step.on_failure === 'retry' ? (step.max_retries ?? 1) + 1 : 1
  const overallStartedAt = Date.now()
  let lastResult: StepResult | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await executeStep(step, execution, ctx)
    lastResult = result

    if (result.status !== 'failed') {
      return {
        ...result,
        startedAt: overallStartedAt,
        completedAt: Date.now(),
        duration: Date.now() - overallStartedAt,
      }
    }

    if (attempt < maxAttempts) {
      console.log(`[abilities] Retrying step ${step.id} (${attempt}/${maxAttempts - 1} retries used)`)
    }
  }

  return {
    ...(lastResult as StepResult),
    startedAt: overallStartedAt,
    completedAt: Date.now(),
    duration: Date.now() - overallStartedAt,
  }
}

function maybeAbortExecution(
  execution: AbilityExecution,
  ctx: ExecutorContext
): AbilityExecution | null {
  const verdict = ctx.shouldAbort?.(execution)
  if (!verdict?.abort) {
    return null
  }

  execution.status = 'failed'
  execution.error = verdict.reason ?? 'Execution aborted by control gate'
  execution.currentStep = null
  execution.completedAt = Date.now()
  ctx.onRunEnd?.(execution)
  return execution
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
      console.error('[abilities] Unable to resolve step order - circular dependency?')
      break
    }

    result.push(next)
    completed.add(next.id)
    remaining.splice(remaining.indexOf(next), 1)
  }

  return result
}

export async function executeAbility(
  ability: Ability,
  inputs: InputValues,
  ctx: ExecutorContext
): Promise<AbilityExecution> {
  const inputErrors = validateInputs(ability, inputs)
  if (inputErrors.length > 0) {
    return {
      id: generateExecutionId(),
      ability,
      inputs,
      status: 'failed',
      currentStep: null,
      currentStepIndex: -1,
      completedSteps: [],
      pendingSteps: ability.steps,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: `Input validation failed: ${inputErrors.map((e) => e.message).join(', ')}`,
    }
  }

  const resolvedInputs: InputValues = { ...inputs }
  if (ability.inputs) {
    for (const [name, def] of Object.entries(ability.inputs)) {
      if (resolvedInputs[name] === undefined && def.default !== undefined) {
        resolvedInputs[name] = def.default
      }
    }
  }

  const orderedSteps = buildExecutionOrder(ability.steps)

  const execution: AbilityExecution = {
    id: generateExecutionId(),
    ability,
    inputs: resolvedInputs,
    status: 'running',
    currentStep: null,
    currentStepIndex: -1,
    completedSteps: [],
    pendingSteps: [...orderedSteps],
    startedAt: Date.now(),
  }

  ctx.onRunStart?.(execution)

  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i]
    execution.currentStep = step
    execution.currentStepIndex = i

    console.log(`[abilities] Step ${i + 1}/${orderedSteps.length}: ${step.id}`)

    const stepOutputs = buildStepOutputMap(execution)
    if (!evaluateCondition(step.when, execution.inputs, stepOutputs)) {
      const skipped = createSkippedResult(step, Date.now())
      execution.completedSteps.push(skipped)
      execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)
      ctx.onStepStart?.(step, execution)
      ctx.onStepComplete?.(step, skipped, execution)
      continue
    }

    ctx.onStepStart?.(step, execution)

    const result = await executeStepWithPolicy(step, execution, ctx)
    execution.completedSteps.push(result)
    execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)

    if (result.validation) {
      ctx.onValidation?.(step, result, execution)
      const aborted = maybeAbortExecution(execution, ctx)
      if (aborted) {
        return aborted
      }
    }

    if (result.status === 'failed') {
      ctx.onStepFail?.(step, new Error(result.error ?? 'Step failed'), execution)

      const aborted = maybeAbortExecution(execution, ctx)
      if (aborted) {
        return aborted
      }

      if (step.on_failure === 'continue') {
        continue
      }

      execution.status = 'failed'
      execution.error = result.error
      execution.completedAt = Date.now()
      ctx.onRunEnd?.(execution)
      return execution
    }

    ctx.onStepComplete?.(step, result, execution)
    const aborted = maybeAbortExecution(execution, ctx)
    if (aborted) {
      return aborted
    }
  }

  execution.status = 'completed'
  execution.currentStep = null
  execution.completedAt = Date.now()
  ctx.onRunEnd?.(execution)

  return execution
}

export function formatExecutionResult(execution: AbilityExecution): string {
  const lines: string[] = []

  lines.push(`Ability: ${execution.ability.name}`)
  lines.push(`Status: ${execution.status === 'completed' ? '✅ Complete' : '❌ Failed'}`)

  if (execution.error) {
    lines.push(`Error: ${execution.error}`)
  }

  lines.push('')
  lines.push('Steps:')

  for (const result of execution.completedSteps) {
    const icon =
      result.status === 'completed' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌'
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

  return lines.join('\n')
}

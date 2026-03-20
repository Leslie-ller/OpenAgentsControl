# Coding Workflow 落地计划

> **目标**: 把 coding workflow 从脚手架状态变为可实际使用的系统  
> **范围**: 仅 coding workflow，不涉及 bibliography 和 context system implementation plan  
> **执行者**: 其他 coding agent  
> **测试命令**: `cd packages/plugin-abilities && bun test`

---

## 前置理解

### 当前已完成的（不需要改）

- ✅ Obligation 解析（三层: inline > runtime > builtin）
- ✅ Gate 评估（10 个 gate，双路径 step-based / event-based）
- ✅ Executor（5 种 step 类型，依赖排序，timeout/retry/hook/permission）
- ✅ Event 基础设施（bus + log + factory）
- ✅ CompletionSummary 三态结果
- ✅ TaskBreakdownBridge 文件生成
- ✅ Focus Refresh 四种触发类型
- ✅ DetailReinjector 已通过 `ability.context.detail` tool 连接
- ✅ 31 个已有测试全部通过

### 需要落地的（本计划的工作）

1. **ability.yaml 的 validate step**：证据 exit_code 来自输入参数而非真实命令返回
2. **CodingArtifactStore**：已实现但未在运行时使用
3. **循环依赖检测**：executor 静默丢弃残余 step
4. **`when` 表达式**：只支持 `inputs.x == "y"`

---

## Task 1: 修复 validate step 的证据真实性

**文件**: `.opencode/abilities/development/code-change/ability.yaml`  
**问题**: validate step 的 `exit_codes` 证据来自 `inputs.validation_exit_code` 参数，而不是 `validation_command` 的真实返回值  
**影响**: gate 系统检查的是调用者自己声明的 exit code，不是真实结果

### 改动

替换 `validate` step（当前 L221-237）为：

```yaml
  - id: validate
    type: script
    run: |
      python3 - <<'PY'
      import json, subprocess, sys, shlex

      cmd = "{{inputs.validation_command}}"
      try:
          result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
          actual_exit_code = result.returncode
          stdout = result.stdout.strip()
          stderr = result.stderr.strip()
      except subprocess.TimeoutExpired:
          actual_exit_code = 124
          stdout = ""
          stderr = "Command timed out after 300s"
      except Exception as e:
          actual_exit_code = 1
          stdout = ""
          stderr = str(e)

      verdict = "pass" if actual_exit_code == 0 else "fail"
      print(json.dumps({
          "commands": [cmd],
          "exit_codes": [actual_exit_code],
          "results": [verdict],
          "stdout_tail": stdout[-500:] if stdout else "",
          "stderr_tail": stderr[-500:] if stderr else "",
          "validated_claims": ["acceptance criteria covered"] if verdict == "pass" else [],
      }))
      PY
    tags: [test, validation, verification-evidence]
    needs: [execute-small, execute-complex]
```

**关键变化**:
- 移除 `set -e; {{inputs.validation_command}} >/dev/null` 这种"跑但不记录"的写法
- 改用 python `subprocess.run` 捕获真实 exit code
- `exit_codes` 使用 `result.returncode` 而非 `inputs.validation_exit_code`
- 保留 stdout/stderr 尾部以供调试
- 命令超时默认 300 秒

**删除的输入参数**: `validation_exit_code`（不再需要，从 `inputs:` 段和 `complete` step 中移除引用）

### 验证

现有测试 `development-code-change-ability.test.ts` 中 "blocks completion when validation evidence reports failure" 需要更新：
- 旧: 传入 `validation_exit_code: 1` 来模拟失败
- 新: 传入 `validation_command: "exit 1"` 让真实命令失败

更新后的测试预期不变：`execution.status === 'failed'`，`validation_gate.verdict === 'block'`

---

## Task 2: 接入 CodingArtifactStore

**文件**: `src/opencode-plugin.ts`  
**问题**: `CodingArtifactStore` 有完整 API（save/load/list 6 种 artifact 类型）但未实例化  
**目标**: 在 `code_change` 执行完成后自动持久化结果到 store

### 改动

#### 2.1 在 plugin 初始化时创建 store

在 `opencode-plugin.ts` 的初始化段（约 L67），checkpointStore 下方加：

```typescript
import { createCodingArtifactStore } from './coding/artifact-store.js'

// ... 在 plugin function 内 ...
const codingArtifactStore = createCodingArtifactStore(ctx.directory)
```

#### 2.2 在 executeAbilityByName 完成后持久化

在 `executeAbilityByName` 函数中（约 L182-196），execution 成功返回后，增加 artifact 持久化逻辑：

```typescript
const execution = await executionManager.execute(ability, inputs, createExecutorContext())

// 持久化 coding 执行记录
if (ability.task_type === 'code_change' && execution.control) {
  const taskId = (inputs.task_id as string) || `task_${Date.now()}`
  try {
    // 保存 completion summary
    const summary = deriveCompletionSummary(execution)
    if (summary) {
      await codingArtifactStore.save('completion-summary', taskId, summary)
    }
    // 保存 validation report（从 validate step output 提取）
    const validateStep = execution.completedSteps.find(s => s.stepId === 'validate')
    if (validateStep?.output) {
      try {
        const validationData = JSON.parse(validateStep.output.trim())
        await codingArtifactStore.save('validation-report', taskId, validationData)
      } catch { /* non-JSON output, skip */ }
    }
    // 保存 review report（从 review step output 提取）
    const reviewStep = execution.completedSteps.find(s => s.stepId === 'review')
    if (reviewStep?.output) {
      try {
        const reviewData = JSON.parse(reviewStep.output.trim())
        await codingArtifactStore.save('review-report', taskId, reviewData)
      } catch { /* non-JSON output, skip */ }
    }
  } catch (err) {
    console.error('[abilities] Failed to persist coding artifacts:', err)
  }
}
```

#### 2.3 添加 artifact 查询 tool

在 `tool:` 段新增：

```typescript
'ability.coding.artifacts': tool({
  description: 'List or load coding workflow artifacts (task plans, validation reports, etc.)',
  args: {
    action: tool.schema.enum(['list', 'load']).describe('Action: list all or load specific'),
    type: tool.schema.optional(tool.schema.string()).describe('Artifact type filter'),
    key: tool.schema.optional(tool.schema.string()).describe('Artifact key for load'),
  },
  async execute({ action, type, key }) {
    if (action === 'list') {
      const items = type
        ? await codingArtifactStore.list(type as any)
        : await codingArtifactStore.listAll()
      return JSON.stringify({ status: 'ok', count: items.length, items })
    }
    if (action === 'load' && type && key) {
      const data = await codingArtifactStore.load(type as any, key)
      return JSON.stringify({ status: data ? 'ok' : 'not_found', data })
    }
    return JSON.stringify({ status: 'error', message: 'Invalid action or missing params' })
  },
}),
```

### 验证

新增测试 `tests/coding-artifact-integration.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { createCodingArtifactStore } from '../src/coding/artifact-store.js'

describe('coding artifact store integration', () => {
  let tmpDir: string
  let store: ReturnType<typeof createCodingArtifactStore>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coding-artifact-'))
    store = createCodingArtifactStore(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('persists and retrieves completion summary', async () => {
    const summary = { status: 'completed', validated: true, reviewed: true, remaining_risks: [], next_actions: [] }
    await store.save('completion-summary', 'task_001', summary)
    const loaded = await store.load('completion-summary', 'task_001')
    expect(loaded).not.toBeNull()
    expect(loaded.status).toBe('completed')
  })

  it('lists all artifacts across types', async () => {
    await store.save('completion-summary', 'task_001', { status: 'completed' })
    await store.save('validation-report', 'task_001', { commands: ['bun test'], exit_codes: [0] })
    const all = await store.listAll()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })
})
```

---

## Task 3: 循环依赖检测 — 抛异常而非静默丢弃

**文件**: `src/executor/index.ts`  
**问题**: `buildExecutionOrder` 遇到循环依赖时 `console.error` + `break`，剩余 step 被静默丢弃  
**影响**: ability YAML 若有循环依赖配置错误，执行器会诡异地跳过一些 step，不报错

### 改动

替换 `buildExecutionOrder` 函数（约 L499-521）：

```typescript
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
      throw new Error(
        `[abilities] Circular or unresolvable step dependency detected. ` +
        `Stuck steps: ${stuckIds}. ` +
        `Completed: ${[...completed].join(', ') || 'none'}`
      )
    }

    result.push(next)
    completed.add(next.id)
    remaining.splice(remaining.indexOf(next), 1)
  }

  return result
}
```

### 验证

在 `tests/executor.test.ts` 新增测试用例：

```typescript
it('should throw on circular step dependencies', async () => {
  const ability: Ability = {
    name: 'circular',
    description: 'Circular dependency test',
    steps: [
      { id: 'a', type: 'script', run: 'echo a', needs: ['b'] },
      { id: 'b', type: 'script', run: 'echo b', needs: ['a'] },
    ],
  }

  expect(executeAbility(ability, {}, createMockContext()))
    .rejects.toThrow('Circular or unresolvable step dependency')
})

it('should throw on missing dependency reference', async () => {
  const ability: Ability = {
    name: 'missing-dep',
    description: 'Missing dependency test',
    steps: [
      { id: 'a', type: 'script', run: 'echo a', needs: ['nonexistent'] },
    ],
  }

  expect(executeAbility(ability, {}, createMockContext()))
    .rejects.toThrow('Circular or unresolvable step dependency')
})
```

---

## Task 4: 扩展 `when` 条件表达式

**文件**: `src/executor/index.ts`  
**问题**: `evaluateCondition` 只支持 `inputs.x == "y"` 和 `inputs.x != "y"`  
**目标**: 增加对数值比较和 step 状态引用的支持

### 改动

替换 `evaluateCondition` 函数（约 L486-497）：

```typescript
function evaluateCondition(
  condition: string,
  inputs: InputValues,
  completedSteps?: StepResult[]
): boolean {
  // Pattern: inputs.x == "value" | inputs.x != "value"
  const stringMatch = condition.match(/^inputs\.(\w+)\s*(==|!=)\s*"([^"]*)"$/)
  if (stringMatch) {
    const [, name, op, value] = stringMatch
    const actual = String(inputs[name] ?? '')
    if (op === '==') return actual === value
    if (op === '!=') return actual !== value
  }

  // Pattern: inputs.x > 5 | inputs.x >= 5 | inputs.x < 5 | inputs.x <= 5
  const numMatch = condition.match(/^inputs\.(\w+)\s*(>|>=|<|<=|==|!=)\s*(\d+(?:\.\d+)?)$/)
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

  // Pattern: steps.x.status == "completed" | steps.x.status != "completed"
  const stepMatch = condition.match(/^steps\.(\w+)\.status\s*(==|!=)\s*"([^"]*)"$/)
  if (stepMatch && completedSteps) {
    const [, stepId, op, value] = stepMatch
    const step = completedSteps.find((s) => s.stepId === stepId)
    const actual = step?.status ?? 'pending'
    if (op === '==') return actual === value
    if (op === '!=') return actual !== value
  }

  // Fallback: treat truthy/falsy
  return Boolean(condition)
}
```

同时更新 `evaluateCondition` 的调用点（约 L652），传入 `execution.completedSteps`：

```typescript
// 旧:
const conditionMet = evaluateCondition(step.when, resolvedInputs)
// 新:
const conditionMet = evaluateCondition(step.when, resolvedInputs, execution.completedSteps)
```

### 验证

在 `tests/executor.test.ts` 新增：

```typescript
it('should evaluate numeric when conditions', async () => {
  const ability: Ability = {
    name: 'numeric-when',
    description: 'Numeric condition test',
    inputs: {
      count: { type: 'number', required: true },
    },
    steps: [
      { id: 'always', type: 'script', run: 'echo always' },
      { id: 'many', type: 'script', run: 'echo many', when: 'inputs.count > 3' },
    ],
  }

  const result = await executeAbility(ability, { count: 2 }, createMockContext())
  expect(result.completedSteps.find(s => s.stepId === 'many')?.status).toBe('skipped')

  const result2 = await executeAbility(ability, { count: 5 }, createMockContext())
  expect(result2.completedSteps.find(s => s.stepId === 'many')?.status).toBe('completed')
})
```

---

## 执行顺序

| 顺序 | Task | 理由 |
|------|------|------|
| 1 | Task 3 (循环依赖) | 最小改动，最高确定性，改一个函数 |
| 2 | Task 4 (when 表达式) | 改一个函数 + 更新一个调用点 |
| 3 | Task 1 (validate 真实性) | 改 YAML + 更新一个测试 |
| 4 | Task 2 (ArtifactStore) | 涉及 plugin 多处修改 + 新 tool + 新测试 |

## 验证方法

每个 task 完成后运行：

```bash
cd /home/leslie/code/OpenAgentsControl/packages/plugin-abilities
bun test
```

所有 25 个测试文件必须全部通过。特别关注：
- `development-code-change-ability.test.ts` — 端到端 ability 测试
- `control.test.ts` — gate 评估测试
- `executor.test.ts` — 执行器测试
- `completion-summary.test.ts` — 完成摘要测试

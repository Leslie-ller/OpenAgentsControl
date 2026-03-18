import type { StateCapsule } from './types.js'

export type FocusTrigger =
  | 'workflow_stage_transition'
  | 'subagent_return'
  | 'large_tool_output'
  | 'pre_high_impact_decision'

export function renderFocusRefreshBlock(capsule: StateCapsule, trigger: FocusTrigger): string {
  const openQuestions = capsule.open_questions.slice(0, 3).map((item) => `  - ${item}`)
  const keyConstraints = capsule.key_constraints.slice(0, 3).map((item) => `  - ${item}`)

  return [
    'Current Focus:',
    `trigger: ${trigger}`,
    `topic: ${capsule.topic}`,
    `current_state: ${capsule.current_state}`,
    `next_action: ${capsule.next_action}`,
    'open_questions:',
    ...(openQuestions.length > 0 ? openQuestions : ['  - none']),
    'key_constraints:',
    ...(keyConstraints.length > 0 ? keyConstraints : ['  - none']),
  ].join('\n')
}

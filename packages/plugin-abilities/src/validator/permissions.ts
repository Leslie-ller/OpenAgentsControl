import { AgentPermissionsSchema, type AgentPermissions, type SkillPermission } from '../context/types.js';
import type { Step, ScriptStep, AgentStep, SkillStep, ApprovalStep, WorkflowStep } from '../types/index.js';

export interface PermissionValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Result of a step-level permission check.
 */
export interface StepPermissionResult {
  allowed: boolean;
  /** Reason for denial, if not allowed */
  reason?: string;
}

export class PermissionValidator {
  validateAgentPermissions(data: unknown): PermissionValidationResult {
    const result = AgentPermissionsSchema.safeParse(data);
    
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }

  checkSkillAccess(agentPermissions: AgentPermissions, skillName: string, toolName: string): boolean {
    const permission = agentPermissions.permissions.find(p => p.skill === skillName);
    
    if (!permission) {
      // Default deny if no explicit permission for skill
      return false;
    }

    if (!permission.tools) {
      // If tools not specified, assume strict/deny or allow all?
      // Security best practice: Default deny.
      return false;
    }

    if (permission.tools.includes('*') || permission.tools.includes(toolName)) {
      return true;
    }

    return false;
  }

  /**
   * Check whether a step is permitted under the given agent permissions.
   * 
   * Permission semantics per step type:
   * - `script`: Checks skill='script', tool=step.id (or '*' for any script)
   * - `agent`:  Checks skill='agent', tool=step.agent
   * - `skill`:  Checks skill=step.skill, tool='*' (or specific tool if provided)
   * - `approval`: Always allowed (approvals are a safety mechanism, not a privilege)
   * - `workflow`: Checks skill='workflow', tool=step.workflow
   * 
   * If no agentPermissions are provided, all steps are allowed (permissive default
   * when the permission system is not configured).
   */
  checkStepPermission(step: Step, agentPermissions?: AgentPermissions): StepPermissionResult {
    // If no permissions configured, allow everything (opt-in model)
    if (!agentPermissions) {
      return { allowed: true };
    }

    switch (step.type) {
      case 'script': {
        const s = step as ScriptStep;
        // Script steps are gated under the 'script' skill, with the step id as tool
        if (this.checkSkillAccess(agentPermissions, 'script', s.id) ||
            this.checkSkillAccess(agentPermissions, 'script', '*')) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Agent '${agentPermissions.agent}' lacks permission for script step '${s.id}'`,
        };
      }

      case 'agent': {
        const s = step as AgentStep;
        // Agent steps are gated under the 'agent' skill, with the agent name as tool
        if (this.checkSkillAccess(agentPermissions, 'agent', s.agent) ||
            this.checkSkillAccess(agentPermissions, 'agent', '*')) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Agent '${agentPermissions.agent}' lacks permission to invoke agent '${s.agent}'`,
        };
      }

      case 'skill': {
        const s = step as SkillStep;
        // Skill steps check the skill name directly with wildcard tool access
        if (this.checkSkillAccess(agentPermissions, s.skill, '*') ||
            this.checkSkillAccess(agentPermissions, s.skill, s.id)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Agent '${agentPermissions.agent}' lacks permission for skill '${s.skill}'`,
        };
      }

      case 'approval': {
        // Approval steps are always allowed — they are a safety gate, not a privilege
        return { allowed: true };
      }

      case 'workflow': {
        const s = step as WorkflowStep;
        if (this.checkSkillAccess(agentPermissions, 'workflow', s.workflow) ||
            this.checkSkillAccess(agentPermissions, 'workflow', '*')) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Agent '${agentPermissions.agent}' lacks permission for workflow '${s.workflow}'`,
        };
      }

      default:
        // Unknown step types are denied by default
        return {
          allowed: false,
          reason: `Unknown step type '${(step as any).type}' — permission denied`,
        };
    }
  }
}

import { describe, expect, it } from 'bun:test'
import { PermissionValidator } from '../src/validator/permissions.js'
import type { AgentPermissions } from '../src/context/types.js'

describe('PermissionValidator', () => {
  const validator = new PermissionValidator()

  // ─────────────────────────────────────────────────────────
  // validateAgentPermissions
  // ─────────────────────────────────────────────────────────

  describe('validateAgentPermissions', () => {
    it('accepts a valid agent permissions object', () => {
      const result = validator.validateAgentPermissions({
        agent: 'researcher',
        permissions: [
          { skill: 'web-search', tools: ['search', 'fetch'] },
          { skill: 'file-ops', tools: ['read'], resources: ['/docs'] },
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts minimal valid permissions (empty permissions array)', () => {
      const result = validator.validateAgentPermissions({
        agent: 'idle-agent',
        permissions: [],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts permissions with optional fields only', () => {
      const result = validator.validateAgentPermissions({
        agent: 'basic',
        permissions: [
          { skill: 'calculator' },
        ],
      })
      expect(result.valid).toBe(true)
    })

    it('accepts permissions with description', () => {
      const result = validator.validateAgentPermissions({
        agent: 'writer',
        permissions: [
          { skill: 'file-ops', tools: ['write'], description: 'Can write files' },
        ],
      })
      expect(result.valid).toBe(true)
    })

    it('rejects missing agent field', () => {
      const result = validator.validateAgentPermissions({
        permissions: [{ skill: 'test', tools: ['a'] }],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('agent'))).toBe(true)
    })

    it('rejects missing permissions field', () => {
      const result = validator.validateAgentPermissions({
        agent: 'test-agent',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('rejects completely empty object', () => {
      const result = validator.validateAgentPermissions({})
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2) // missing agent + permissions
    })

    it('rejects null input', () => {
      const result = validator.validateAgentPermissions(null)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('rejects non-object input', () => {
      const result = validator.validateAgentPermissions('not an object')
      expect(result.valid).toBe(false)
    })

    it('rejects non-string agent', () => {
      const result = validator.validateAgentPermissions({
        agent: 42,
        permissions: [],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('agent'))).toBe(true)
    })

    it('rejects non-array permissions', () => {
      const result = validator.validateAgentPermissions({
        agent: 'test',
        permissions: 'not-an-array',
      })
      expect(result.valid).toBe(false)
    })

    it('rejects permission entry without skill field', () => {
      const result = validator.validateAgentPermissions({
        agent: 'test',
        permissions: [{ tools: ['a'] }],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects non-string values in tools array', () => {
      const result = validator.validateAgentPermissions({
        agent: 'test',
        permissions: [{ skill: 'x', tools: [123] }],
      })
      expect(result.valid).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────
  // checkSkillAccess
  // ─────────────────────────────────────────────────────────

  describe('checkSkillAccess', () => {
    const perms: AgentPermissions = {
      agent: 'researcher',
      permissions: [
        { skill: 'web-search', tools: ['search', 'fetch'] },
        { skill: 'file-ops', tools: ['read'] },
        { skill: 'admin', tools: ['*'] },
        { skill: 'locked' }, // no tools field → default deny
      ],
    }

    it('allows access to an explicitly listed tool', () => {
      expect(validator.checkSkillAccess(perms, 'web-search', 'search')).toBe(true)
      expect(validator.checkSkillAccess(perms, 'web-search', 'fetch')).toBe(true)
      expect(validator.checkSkillAccess(perms, 'file-ops', 'read')).toBe(true)
    })

    it('denies access to a tool not in the list', () => {
      expect(validator.checkSkillAccess(perms, 'web-search', 'delete')).toBe(false)
      expect(validator.checkSkillAccess(perms, 'file-ops', 'write')).toBe(false)
    })

    it('allows access via wildcard (*)', () => {
      expect(validator.checkSkillAccess(perms, 'admin', 'anything')).toBe(true)
      expect(validator.checkSkillAccess(perms, 'admin', 'deploy')).toBe(true)
      expect(validator.checkSkillAccess(perms, 'admin', 'delete-all')).toBe(true)
    })

    it('denies access to a skill not listed at all (default deny)', () => {
      expect(validator.checkSkillAccess(perms, 'unknown-skill', 'any-tool')).toBe(false)
    })

    it('denies access when skill exists but tools is undefined (default deny)', () => {
      expect(validator.checkSkillAccess(perms, 'locked', 'any-tool')).toBe(false)
    })

    it('denies access when permissions array is empty', () => {
      const emptyPerms: AgentPermissions = { agent: 'nobody', permissions: [] }
      expect(validator.checkSkillAccess(emptyPerms, 'web-search', 'search')).toBe(false)
    })

    it('is case-sensitive for skill names', () => {
      expect(validator.checkSkillAccess(perms, 'Web-Search', 'search')).toBe(false)
      expect(validator.checkSkillAccess(perms, 'WEB-SEARCH', 'search')).toBe(false)
    })

    it('is case-sensitive for tool names', () => {
      expect(validator.checkSkillAccess(perms, 'web-search', 'Search')).toBe(false)
      expect(validator.checkSkillAccess(perms, 'web-search', 'FETCH')).toBe(false)
    })

    it('handles empty tools array as deny', () => {
      const permsWithEmpty: AgentPermissions = {
        agent: 'test',
        permissions: [{ skill: 'empty', tools: [] }],
      }
      expect(validator.checkSkillAccess(permsWithEmpty, 'empty', 'anything')).toBe(false)
    })

    it('handles multiple permissions for different skills independently', () => {
      // web-search allows 'search' but file-ops does not
      expect(validator.checkSkillAccess(perms, 'web-search', 'search')).toBe(true)
      expect(validator.checkSkillAccess(perms, 'file-ops', 'search')).toBe(false)
    })
  })
})

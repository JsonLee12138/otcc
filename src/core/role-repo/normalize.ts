import type { Role, Skill } from '../role/schema'
import {
  parseSkillInput,

  validateRole,
} from '../role/schema'

function normalizeSkill(skill: unknown): Skill {
  if (typeof skill === 'string') {
    return parseSkillInput(skill)
  }

  if (skill && typeof skill === 'object') {
    const record = skill as Record<string, unknown>
    return {
      path: typeof record.path === 'string' ? record.path : '',
      name: typeof record.name === 'string' ? record.name : '',
      description:
        typeof record.description === 'string' ? record.description : '',
    }
  }

  return {
    path: '',
    name: '',
    description: '',
  }
}

export function normalizeRoleData(data: unknown): Role {
  const record
    = data && typeof data === 'object'
      ? { ...(data as Record<string, unknown>) }
      : {}

  const normalized = {
    ...record,
    inScope: Array.isArray(record.inScope) ? record.inScope.map(String) : [],
    outOfScope: Array.isArray(record.outOfScope)
      ? record.outOfScope.map(String)
      : [],
    skills: Array.isArray(record.skills)
      ? record.skills.map(normalizeSkill)
      : [],
  }

  return validateRole(normalized)
}

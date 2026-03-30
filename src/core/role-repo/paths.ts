import type { Scope } from './types'
import { getGlobalRolesDir, getLocalRolesDir } from '../role/schema'

export function getRoleRepoConfigPath(scope: Scope): string {
  if (scope === 'global') {
    return `${getGlobalRolesDir().replace(/\/roles$/, '')}/role-repos.json`
  }

  return `${getLocalRolesDir().replace(/\/roles$/, '')}/role-repos.json`
}

export function getRoleRepoCachePath(scope: Scope): string {
  if (scope === 'global') {
    return `${getGlobalRolesDir().replace(/\/roles$/, '')}/role-repo-cache.json`
  }

  return `${getLocalRolesDir().replace(/\/roles$/, '')}/role-repo-cache.json`
}

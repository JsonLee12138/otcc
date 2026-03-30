import type { Role } from '../role/schema'

export type Scope = 'local' | 'global'

export interface RoleRepoSource {
  name: string
  url: string
  owner: string
  repo: string
  branch?: string
  addedAt: string
  updatedAt: string
}

export interface RoleRepoStore {
  repos: RoleRepoSource[]
}

export interface CachedRemoteRole {
  fileName: string
  path: string
  sha?: string
  role: Role
}

export interface RoleRepoCacheEntry {
  fetchedAt: string
  roles: CachedRemoteRole[]
}

export interface RoleRepoCache {
  repos: Record<string, RoleRepoCacheEntry>
}

export interface CheckIssue {
  path: string
  message: string
}

export interface CheckResult {
  repo: RoleRepoSource
  ok: boolean
  roleCount: number
  fetchedAt: string
  issues: CheckIssue[]
}

export interface FindRoleOptions {
  keyword?: string
  roleNames?: string[]
}

export interface FoundRemoteRole extends CachedRemoteRole {
  repo: string
  url: string
}

import type {
  CheckResult,
  FindRoleOptions,
  FoundRemoteRole,
  RoleRepoSource,
  Scope,
} from './types'
import { parseGitHubRepoUrl, scanGitHubRoleRepo } from './client'
import {
  listRoleRepos,
  readRoleRepoCache,
  removeRoleRepo,
  saveRoleRepo,
  writeRoleRepoCache,
} from './store'

function nowIso(): string {
  return new Date().toISOString()
}

export async function addRoleRepo(
  scope: Scope,
  name: string,
  url: string,
): Promise<RoleRepoSource> {
  const parsed = parseGitHubRepoUrl(url)
  const timestamp = nowIso()
  const repo: RoleRepoSource = {
    name,
    url,
    owner: parsed.owner,
    repo: parsed.repo,
    branch: parsed.branch,
    addedAt: timestamp,
    updatedAt: timestamp,
  }

  await saveRoleRepo(scope, repo)
  return repo
}

export async function listRoleRepoSources(
  scope: Scope,
): Promise<RoleRepoSource[]> {
  return await listRoleRepos(scope)
}

export async function removeRoleRepoSource(
  scope: Scope,
  name: string,
): Promise<boolean> {
  return await removeRoleRepo(scope, name)
}

export async function checkRoleRepos(
  scope: Scope,
  targetName?: string,
): Promise<CheckResult[]> {
  const repos = await listRoleRepos(scope)
  const selected = targetName
    ? repos.filter(repo => repo.name === targetName)
    : repos

  if (targetName && selected.length === 0) {
    throw new Error(`未找到 role repo: ${targetName}`)
  }

  const results: CheckResult[] = []
  for (const repo of selected) {
    try {
      const scanned = await scanGitHubRoleRepo(repo)
      results.push({
        repo: { ...repo, branch: scanned.branch },
        ok: scanned.issues.length === 0,
        roleCount: scanned.roles.length,
        fetchedAt: nowIso(),
        issues: scanned.issues,
      })
    }
    catch (error) {
      results.push({
        repo,
        ok: false,
        roleCount: 0,
        fetchedAt: nowIso(),
        issues: [
          {
            path: '.otcc/roles',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      })
    }
  }

  return results
}

export async function updateRoleRepos(
  scope: Scope,
  targetName?: string,
): Promise<CheckResult[]> {
  const repos = await listRoleRepos(scope)
  const selected = targetName
    ? repos.filter(repo => repo.name === targetName)
    : repos

  if (targetName && selected.length === 0) {
    throw new Error(`未找到 role repo: ${targetName}`)
  }

  const cache = await readRoleRepoCache(scope)
  const results: CheckResult[] = []

  for (const repo of selected) {
    try {
      const scanned = await scanGitHubRoleRepo(repo)
      cache.repos[repo.name] = {
        fetchedAt: nowIso(),
        roles: scanned.roles,
      }
      await saveRoleRepo(scope, {
        ...repo,
        branch: scanned.branch,
        updatedAt: nowIso(),
      })
      results.push({
        repo: { ...repo, branch: scanned.branch },
        ok: scanned.issues.length === 0,
        roleCount: scanned.roles.length,
        fetchedAt: cache.repos[repo.name].fetchedAt,
        issues: scanned.issues,
      })
    }
    catch (error) {
      results.push({
        repo,
        ok: false,
        roleCount: 0,
        fetchedAt: nowIso(),
        issues: [
          {
            path: '.otcc/roles',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      })
    }
  }

  await writeRoleRepoCache(scope, cache)
  return results
}

async function ensureRoleRepoCache(
  scope: Scope,
): Promise<Awaited<ReturnType<typeof readRoleRepoCache>>> {
  const repos = await listRoleRepos(scope)
  const cache = await readRoleRepoCache(scope)
  const missing = repos.filter(repo => !cache.repos[repo.name])

  if (missing.length === 0) {
    return cache
  }

  for (const repo of missing) {
    try {
      const scanned = await scanGitHubRoleRepo(repo)
      cache.repos[repo.name] = {
        fetchedAt: nowIso(),
        roles: scanned.roles,
      }
      await saveRoleRepo(scope, {
        ...repo,
        branch: scanned.branch,
        updatedAt: nowIso(),
      })
    }
    catch {
      cache.repos[repo.name] = {
        fetchedAt: nowIso(),
        roles: [],
      }
    }
  }

  await writeRoleRepoCache(scope, cache)
  return cache
}

export async function findRoles(
  scope: Scope,
  options: FindRoleOptions,
): Promise<FoundRemoteRole[]> {
  const repos = await listRoleRepos(scope)
  const cache = await ensureRoleRepoCache(scope)
  const keyword = options.keyword?.trim().toLowerCase()
  const roleNames = new Set(
    (options.roleNames || [])
      .map(name => name.trim().toLowerCase())
      .filter(Boolean),
  )

  const found: FoundRemoteRole[] = []
  for (const repo of repos) {
    const roles = cache.repos[repo.name]?.roles || []
    for (const item of roles) {
      const haystack = [
        item.role.name,
        item.role.fileName,
        item.role.description,
        ...item.role.inScope,
        ...item.role.outOfScope,
      ]
        .join('\n')
        .toLowerCase()

      const matchesKeyword = !keyword || haystack.includes(keyword)
      const matchesRoleName
        = roleNames.size === 0
          || roleNames.has(item.role.name.toLowerCase())
          || roleNames.has(item.role.fileName.toLowerCase())

      if (matchesKeyword && matchesRoleName) {
        found.push({
          ...item,
          repo: repo.name,
          url: repo.url,
        })
      }
    }
  }

  found.sort((a, b) => a.role.fileName.localeCompare(b.role.fileName))
  return found
}

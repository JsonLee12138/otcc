import type {
  RoleRepoCache,
  RoleRepoSource,
  RoleRepoStore,
  Scope,
} from './types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getRoleRepoCachePath, getRoleRepoConfigPath } from './paths'

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  }
  catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readRoleRepoStore(scope: Scope): Promise<RoleRepoStore> {
  const data = await readJsonFile<RoleRepoStore>(getRoleRepoConfigPath(scope), {
    repos: [],
  })
  return {
    repos: Array.isArray(data.repos) ? data.repos : [],
  }
}

export async function writeRoleRepoStore(
  scope: Scope,
  store: RoleRepoStore,
): Promise<void> {
  await writeJsonFile(getRoleRepoConfigPath(scope), store)
}

export async function listRoleRepos(scope: Scope): Promise<RoleRepoSource[]> {
  const store = await readRoleRepoStore(scope)
  return store.repos
}

export async function saveRoleRepo(
  scope: Scope,
  repo: RoleRepoSource,
): Promise<void> {
  const store = await readRoleRepoStore(scope)
  const nextRepos = store.repos.filter(item => item.name !== repo.name)
  nextRepos.push(repo)
  nextRepos.sort((a, b) => a.name.localeCompare(b.name))
  await writeRoleRepoStore(scope, { repos: nextRepos })
}

export async function removeRoleRepo(
  scope: Scope,
  name: string,
): Promise<boolean> {
  const store = await readRoleRepoStore(scope)
  const nextRepos = store.repos.filter(repo => repo.name !== name)

  if (nextRepos.length === store.repos.length) {
    return false
  }

  await writeRoleRepoStore(scope, { repos: nextRepos })

  const cache = await readRoleRepoCache(scope)
  if (cache.repos[name]) {
    delete cache.repos[name]
    await writeRoleRepoCache(scope, cache)
  }

  return true
}

export async function readRoleRepoCache(scope: Scope): Promise<RoleRepoCache> {
  const data = await readJsonFile<RoleRepoCache>(getRoleRepoCachePath(scope), {
    repos: {},
  })
  return {
    repos: data.repos && typeof data.repos === 'object' ? data.repos : {},
  }
}

export async function writeRoleRepoCache(
  scope: Scope,
  cache: RoleRepoCache,
): Promise<void> {
  await writeJsonFile(getRoleRepoCachePath(scope), cache)
}

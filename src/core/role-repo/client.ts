import type { CachedRemoteRole, CheckIssue, RoleRepoSource } from './types'
import { normalizeRoleData } from './normalize'

interface GitHubContentItem {
  type: 'file' | 'dir'
  name: string
  path: string
  sha?: string
  download_url?: string | null
}

interface GitHubRepoInfo {
  default_branch: string
}

function buildGitHubApiUrl(path: string): string {
  return `https://api.github.com${path}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'otcc-role-repo',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub 请求失败 (${response.status})`)
  }

  return (await response.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.raw+json',
      'User-Agent': 'otcc-role-repo',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub 文件读取失败 (${response.status})`)
  }

  return await response.text()
}

function stripGitSuffix(value: string): string {
  return value.endsWith('.git') ? value.slice(0, -4) : value
}

export function parseGitHubRepoUrl(
  url: string,
): Pick<RoleRepoSource, 'owner' | 'repo' | 'branch'> {
  const parsed = new URL(url)
  if (parsed.hostname !== 'github.com') {
    throw new Error('当前仅支持 github.com 仓库地址')
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    throw new Error('GitHub 仓库地址格式不正确')
  }

  const owner = segments[0]
  const repo = stripGitSuffix(segments[1])
  let branch: string | undefined

  if (segments[2] === 'tree' && segments[3]) {
    branch = segments[3]
  }

  return { owner, repo, branch }
}

async function resolveDefaultBranch(
  owner: string,
  repo: string,
): Promise<string> {
  const data = await fetchJson<GitHubRepoInfo>(
    buildGitHubApiUrl(`/repos/${owner}/${repo}`),
  )
  return data.default_branch
}

async function listRoleFiles(
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubContentItem[]> {
  const encodedPath = encodeURIComponent('.otcc/roles')
  const url = buildGitHubApiUrl(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
  )
  const data = await fetchJson<GitHubContentItem | GitHubContentItem[]>(url)

  if (!Array.isArray(data)) {
    throw new TypeError('`.otcc/roles` 不是目录')
  }

  return data.filter(
    item => item.type === 'file' && item.name.endsWith('.json'),
  )
}

export async function scanGitHubRoleRepo(
  repoSource: RoleRepoSource,
): Promise<{
  branch: string
  roles: CachedRemoteRole[]
  issues: CheckIssue[]
}> {
  const branch
    = repoSource.branch
      || (await resolveDefaultBranch(repoSource.owner, repoSource.repo))
  const files = await listRoleFiles(repoSource.owner, repoSource.repo, branch)
  const roles: CachedRemoteRole[] = []
  const issues: CheckIssue[] = []

  for (const file of files) {
    try {
      const downloadUrl
        = file.download_url
          || `https://raw.githubusercontent.com/${repoSource.owner}/${repoSource.repo}/${branch}/${file.path}`
      const content = await fetchText(downloadUrl)
      const role = normalizeRoleData(JSON.parse(content))
      roles.push({
        fileName: role.fileName,
        path: file.path,
        sha: file.sha,
        role,
      })
    }
    catch (error) {
      issues.push({
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { branch, roles, issues }
}

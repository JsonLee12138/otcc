import { execSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/

export const VERSION_FILES = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
] as const

export const PLUGIN_VERSION_FILES = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
] as const

export function parseReleaseTag(tag: string): string {
  const match = RELEASE_TAG_PATTERN.exec(tag)

  if (!match)
    throw new Error('tag 必须匹配 vX.Y.Z')

  return match[1]
}

export function assertReleaseVersionMatchesPackage(
  packageVersion: string,
  tagVersion: string,
): void {
  if (packageVersion !== tagVersion) {
    throw new Error(
      `package.json version ${packageVersion} 与 tag version ${tagVersion} 不一致`,
    )
  }
}

export function updateJsonVersion(source: string, version: string): string {
  const data = JSON.parse(source) as Record<string, unknown>
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`
}

export async function readPackageVersion(cwd: string): Promise<string> {
  const raw = await readFile(join(cwd, 'package.json'), 'utf8')
  const pkg = JSON.parse(raw) as { version?: string }
  if (!pkg.version)
    throw new Error('package.json 缺少 version 字段')
  return pkg.version
}

export async function assertPluginVersionsMatch(
  cwd: string,
  tagVersion: string,
): Promise<void> {
  const pkgVersion = await readPackageVersion(cwd)
  assertReleaseVersionMatchesPackage(pkgVersion, tagVersion)

  for (const rel of PLUGIN_VERSION_FILES) {
    const abs = join(cwd, rel)
    const raw = await readFile(abs, 'utf8')
    const data = JSON.parse(raw) as Record<string, unknown>
    if (String(data.version) !== tagVersion) {
      throw new Error(
        `${rel} version ${String(data.version)} 与 tag version ${tagVersion} 不一致`,
      )
    }
  }
}

export async function syncPluginVersions(
  cwd: string,
  version: string,
): Promise<void> {
  for (const rel of PLUGIN_VERSION_FILES) {
    const abs = join(cwd, rel)
    const raw = await readFile(abs, 'utf8')
    const updated = updateJsonVersion(raw, version)
    await writeFile(abs, updated, 'utf8')
  }
}

export async function syncVersionFiles(
  cwd: string,
  version: string,
): Promise<void> {
  for (const rel of VERSION_FILES) {
    const abs = join(cwd, rel)
    const raw = await readFile(abs, 'utf8')
    const updated = updateJsonVersion(raw, version)
    await writeFile(abs, updated, 'utf8')
  }
}

export function ensureGitTagMissing(cwd: string, tag: string): void {
  const existing = execSync(`git tag --list ${tag}`, {
    cwd,
    encoding: 'utf8',
  }).trim()
  if (existing) {
    throw new Error(`tag ${tag} 已存在`)
  }
}

export function createGitTag(cwd: string, tag: string): void {
  execSync(`git tag ${tag}`, { cwd })
}

export async function verifyReleaseTag(
  cwd: string,
  tag: string,
): Promise<string> {
  const tagVersion = parseReleaseTag(tag)

  for (const rel of VERSION_FILES) {
    const abs = join(cwd, rel)
    const raw = await readFile(abs, 'utf8')
    const data = JSON.parse(raw) as Record<string, unknown>
    if (String(data.version) !== tagVersion) {
      throw new Error(
        `${rel} version ${String(data.version)} 与 tag version ${tagVersion} 不一致`,
      )
    }
  }

  return tagVersion
}

export async function syncReleaseTag(
  cwd: string,
  tag: string,
): Promise<string> {
  const tagVersion = parseReleaseTag(tag)
  ensureGitTagMissing(cwd, tag)
  await syncVersionFiles(cwd, tagVersion)
  createGitTag(cwd, tag)
  return tagVersion
}

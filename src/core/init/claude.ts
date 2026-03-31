import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type InitAction = 'created' | 'inserted' | 'updated'

const OTCC_ROLE_START = '<!-- otcc:role -->'
const OTCC_ROLE_END = '<!-- otcc:role-end -->'
const BROKEN_BLOCK_ERROR = '检测到损坏的 <!-- otcc:role --> block'

export function buildOtccRoleBlock(template: string): string {
  const normalizedTemplate = template.replace(/\s+$/u, '')
  return `${OTCC_ROLE_START}\n${normalizedTemplate}\n${OTCC_ROLE_END}`
}

export function applyOtccRoleBlock(
  current: string | null,
  block: string,
): { action: InitAction, content: string } {
  if (current === null) {
    return {
      action: 'created',
      content: `${block}\n`,
    }
  }

  const hasStart = current.includes(OTCC_ROLE_START)
  const hasEnd = current.includes(OTCC_ROLE_END)

  if (hasStart !== hasEnd) {
    throw new Error(BROKEN_BLOCK_ERROR)
  }

  if (hasStart && hasEnd) {
    const roleBlockPattern
      = /<!-- otcc:role -->[\s\S]*?<!-- otcc:role-end -->/u

    if (!roleBlockPattern.test(current)) {
      throw new Error(BROKEN_BLOCK_ERROR)
    }

    return {
      action: 'updated',
      content: current.replace(roleBlockPattern, block),
    }
  }

  return {
    action: 'inserted',
    content: `${block}\n\n${current}`,
  }
}

export function resolveTemplatePath(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  return resolve(moduleDir, '../../../templates/role-priority-prompt.md')
}

export async function readRolePriorityTemplate(): Promise<string> {
  return await readFile(resolveTemplatePath(), 'utf8')
}

export async function initClaudeMd(
  cwd: string,
): Promise<{ action: InitAction, filePath: string }> {
  const filePath = resolve(cwd, 'CLAUDE.md')

  let current: string | null = null
  try {
    current = await readFile(filePath, 'utf8')
  }
  catch (error) {
    if (
      !(error instanceof Error)
      || !('code' in error)
      || error.code !== 'ENOENT'
    ) {
      throw error
    }
  }

  const template = await readRolePriorityTemplate()
  const block = buildOtccRoleBlock(template)
  const next = applyOtccRoleBlock(current, block)

  await writeFile(filePath, next.content, 'utf8')

  return {
    action: next.action,
    filePath,
  }
}

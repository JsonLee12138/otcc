import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'

const projectRoot = resolve(import.meta.dir, '../..')

function runInit(workspace: string) {
  const proc = Bun.spawnSync({
    cmd: ['bun', 'run', `${projectRoot}/src/index.ts`, 'init'],
    cwd: workspace,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  }
}

function countOccurrences(source: string, target: string) {
  return source.split(target).length - 1
}

const tempDirs: string[] = []

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'otcc-init-cmd-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir)
      rmSync(dir, { force: true, recursive: true })
  }
})

describe('otcc init command', () => {
  it('creates CLAUDE.md when missing', () => {
    const workspace = createWorkspace()
    const target = join(workspace, 'CLAUDE.md')

    const result = runInit(workspace)

    expect(result.exitCode).toBe(0)
    expect(existsSync(target)).toBe(true)

    const content = readFileSync(target, 'utf8')
    expect(content).toContain('<otcc-role>')
    expect(content).toContain('</otcc-role>')
  })

  it('inserts block at top when CLAUDE.md already exists', () => {
    const workspace = createWorkspace()
    const target = join(workspace, 'CLAUDE.md')
    const existing = 'existing line 1\nexisting line 2\n'
    writeFileSync(target, existing, 'utf8')

    const result = runInit(workspace)

    expect(result.exitCode).toBe(0)

    const content = readFileSync(target, 'utf8')
    expect(content.startsWith('<otcc-role>\n')).toBe(true)
    expect(content).toContain('</otcc-role>\n\n')
    expect(content.endsWith(existing)).toBe(true)
  })

  it('replaces existing otcc-role block', () => {
    const workspace = createWorkspace()
    const target = join(workspace, 'CLAUDE.md')
    writeFileSync(
      target,
      '<otcc-role>\nold role block\n</otcc-role>\n\nnormal content\n',
      'utf8',
    )

    const result = runInit(workspace)

    expect(result.exitCode).toBe(0)

    const content = readFileSync(target, 'utf8')
    expect(content).not.toContain('old role block')
    expect(content).toContain('normal content\n')
    expect(countOccurrences(content, '<otcc-role>')).toBe(1)
    expect(countOccurrences(content, '</otcc-role>')).toBe(1)
  })

  it('fails on broken otcc-role block', () => {
    const workspace = createWorkspace()
    const target = join(workspace, 'CLAUDE.md')
    writeFileSync(target, '<otcc-role>\nbroken block\n\nnormal content\n', 'utf8')

    const result = runInit(workspace)

    expect(result.exitCode).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('检测到损坏的 <otcc-role> block')
  })
})

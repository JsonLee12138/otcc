import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'

const projectRoot = resolve(import.meta.dir, '../..')
const tempDirs: string[] = []

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'otcc-tag-script-test-'))
  tempDirs.push(dir)
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true })
  return dir
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function run(cwd: string, cmd: string[]) {
  const proc = Bun.spawnSync({
    cmd,
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir)
      rmSync(dir, { force: true, recursive: true })
  }
})

describe('scripts/tag.ts', () => {
  it('passes when all versions match the tag', () => {
    const workspace = createWorkspace()

    writeJson(join(workspace, 'package.json'), {
      name: '@jsonlee_12138/otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/plugin.json'), {
      name: 'otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/marketplace.json'), {
      name: 'otcc',
      version: '1.2.3',
    })

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('release version check passed: 1.2.3')
  })

  it('fails on an invalid tag format', () => {
    const workspace = createWorkspace()

    writeJson(join(workspace, 'package.json'), {
      name: '@jsonlee_12138/otcc',
      version: '1.2.2',
    })
    writeJson(join(workspace, '.claude-plugin/plugin.json'), {
      name: 'otcc',
      version: '0.1.0',
    })
    writeJson(join(workspace, '.claude-plugin/marketplace.json'), {
      name: 'otcc',
      version: '0.1.0',
    })

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      'v1.2',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'tag 必须匹配 vX.Y.Z',
    )
  })

  it('fails when plugin.json version does not match tag', () => {
    const workspace = createWorkspace()

    writeJson(join(workspace, 'package.json'), {
      name: '@jsonlee_12138/otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/plugin.json'), {
      name: 'otcc',
      version: '0.1.0',
    })
    writeJson(join(workspace, '.claude-plugin/marketplace.json'), {
      name: 'otcc',
      version: '1.2.3',
    })

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '.claude-plugin/plugin.json',
    )
    expect(`${result.stdout}\n${result.stderr}`).toContain('0.1.0')
    expect(`${result.stdout}\n${result.stderr}`).toContain('1.2.3')
    expect(`${result.stdout}\n${result.stderr}`).toContain('不一致')
  })

  it('fails when marketplace.json version does not match tag', () => {
    const workspace = createWorkspace()

    writeJson(join(workspace, 'package.json'), {
      name: '@jsonlee_12138/otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/plugin.json'), {
      name: 'otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/marketplace.json'), {
      name: 'otcc',
      version: '0.1.0',
    })

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '.claude-plugin/marketplace.json',
    )
    expect(`${result.stdout}\n${result.stderr}`).toContain('0.1.0')
    expect(`${result.stdout}\n${result.stderr}`).toContain('1.2.3')
    expect(`${result.stdout}\n${result.stderr}`).toContain('不一致')
  })

  it('works with --check flag (backward compat with CI)', () => {
    const workspace = createWorkspace()

    writeJson(join(workspace, 'package.json'), {
      name: '@jsonlee_12138/otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/plugin.json'), {
      name: 'otcc',
      version: '1.2.3',
    })
    writeJson(join(workspace, '.claude-plugin/marketplace.json'), {
      name: 'otcc',
      version: '1.2.3',
    })

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      '--check',
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('release version check passed: 1.2.3')
  })
})

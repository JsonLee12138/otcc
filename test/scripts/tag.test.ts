import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
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

function initGitRepo(workspace: string) {
  expect(run(workspace, ['git', 'init']).exitCode).toBe(0)
  writeFileSync(join(workspace, 'README.md'), 'fixture\n', 'utf8')
  expect(run(workspace, ['git', 'add', 'README.md']).exitCode).toBe(0)
  expect(
    run(workspace, [
      'git',
      '-c',
      'user.name=OTCC Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'init',
    ]).exitCode,
  ).toBe(0)
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir)
      rmSync(dir, { force: true, recursive: true })
  }
})

describe('scripts/tag.ts', () => {
  it('updates package.json and .claude-plugin versions before creating the git tag', () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(
      'created v1.2.3 and synced .claude-plugin versions to 1.2.3',
    )

    const pkg = JSON.parse(
      readFileSync(join(workspace, 'package.json'), 'utf8'),
    ) as { version: string }
    expect(pkg.version).toBe('1.2.3')
    expect(
      readFileSync(join(workspace, '.claude-plugin/plugin.json'), 'utf8'),
    ).toContain('"version": "1.2.3"')
    expect(
      readFileSync(join(workspace, '.claude-plugin/marketplace.json'), 'utf8'),
    ).toContain('"version": "1.2.3"')

    const tagList = run(workspace, ['git', 'tag', '--list', 'v1.2.3'])
    expect(tagList.stdout.trim()).toBe('v1.2.3')
  })

  it('fails on an invalid tag before modifying any version files', () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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

    const pkg = JSON.parse(
      readFileSync(join(workspace, 'package.json'), 'utf8'),
    ) as { version: string }
    expect(pkg.version).toBe('1.2.2')
    expect(
      readFileSync(join(workspace, '.claude-plugin/plugin.json'), 'utf8'),
    ).toContain('"version": "0.1.0"')
    expect(
      readFileSync(join(workspace, '.claude-plugin/marketplace.json'), 'utf8'),
    ).toContain('"version": "0.1.0"')

    const tagList = run(workspace, ['git', 'tag', '--list', 'v1.2'])
    expect(tagList.stdout.trim()).toBe('')
  })

  it('verifies versions in check mode without creating the tag', () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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

    const tagList = run(workspace, ['git', 'tag', '--list', 'v1.2.3'])
    expect(tagList.stdout.trim()).toBe('')
    expect(existsSync(join(workspace, '.claude-plugin/plugin.json'))).toBe(
      true,
    )
  })

  it('fails in check mode when .claude-plugin/plugin.json version does not match tag', () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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
      '--check',
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '.claude-plugin/plugin.json',
    )
    expect(`${result.stdout}\n${result.stderr}`).toContain('0.1.0')
    expect(`${result.stdout}\n${result.stderr}`).toContain('1.2.3')
    expect(`${result.stdout}\n${result.stderr}`).toContain('不一致')

    const tagList = run(workspace, ['git', 'tag', '--list', 'v1.2.3'])
    expect(tagList.stdout.trim()).toBe('')
  })

  it('does not modify .claude-plugin files when git tag already exists', async () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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

    // Pre-create the tag so it already exists
    run(workspace, ['git', 'tag', 'v1.2.3'])

    // Record file stats BEFORE running the script
    const pluginPath = join(workspace, '.claude-plugin/plugin.json')
    const marketplacePath = join(workspace, '.claude-plugin/marketplace.json')
    const pluginMtimeBefore = statSync(pluginPath).mtimeMs
    const marketplaceMtimeBefore = statSync(marketplacePath).mtimeMs

    const result = run(workspace, [
      'bun',
      'run',
      `${projectRoot}/scripts/tag.ts`,
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain('tag v1.2.3 已存在')

    // File modification times should be unchanged - no write occurred
    expect(statSync(pluginPath).mtimeMs).toBe(pluginMtimeBefore)
    expect(statSync(marketplacePath).mtimeMs).toBe(marketplaceMtimeBefore)
  })

  it('fails in check mode when .claude-plugin/marketplace.json version does not match tag', () => {
    const workspace = createWorkspace()
    initGitRepo(workspace)

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
      '--check',
      'v1.2.3',
    ])

    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '.claude-plugin/marketplace.json',
    )
    expect(`${result.stdout}\n${result.stderr}`).toContain('0.1.0')
    expect(`${result.stdout}\n${result.stderr}`).toContain('1.2.3')
    expect(`${result.stdout}\n${result.stderr}`).toContain('不一致')

    const tagList = run(workspace, ['git', 'tag', '--list', 'v1.2.3'])
    expect(tagList.stdout.trim()).toBe('')
  })
})

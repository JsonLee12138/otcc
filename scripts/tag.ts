import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/

const VERSION_FILES = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
] as const

function parseReleaseTag(tag: string): string {
  const match = RELEASE_TAG_PATTERN.exec(tag)
  if (!match)
    throw new Error('tag 必须匹配 vX.Y.Z')
  return match[1]
}

async function verifyReleaseTag(cwd: string, tag: string): Promise<void> {
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
}

async function main() {
  const args = process.argv.slice(2)
  const tagArg = args.find(a => !a.startsWith('--'))

  if (!tagArg) {
    process.stderr.write('用法: bun run tag -- --check vX.Y.Z\n')
    process.exit(1)
  }

  try {
    await verifyReleaseTag(process.cwd(), tagArg)
    process.stdout.write(
      `release version check passed: ${parseReleaseTag(tagArg)}\n`,
    )
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

main()

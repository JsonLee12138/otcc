import { resolve } from 'node:path'
import { syncReleaseTag, verifyReleaseTag } from '../src/core/release/tag'

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const tagArg = args.find(a => a !== '--check')

  if (!tagArg) {
    process.stderr.write('用法: bun run tag -- [--check] vX.Y.Z\n')
    process.exit(1)
  }

  const cwd = resolve(process.cwd())

  try {
    if (checkOnly) {
      const version = await verifyReleaseTag(cwd, tagArg)
      process.stdout.write(`release version check passed: ${version}\n`)
    }
    else {
      const version = await syncReleaseTag(cwd, tagArg)
      process.stdout.write(
        `created ${tagArg} and synced .claude-plugin versions to ${version}\n`,
      )
    }
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

main()

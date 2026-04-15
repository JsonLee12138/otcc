import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

async function main() {
  const tag = process.argv[2]

  if (!tag) {
    process.stderr.write('用法: bun run release vX.Y.Z\n')
    process.exit(1)
  }

  const cwd = resolve(process.cwd())

  try {
    // 执行 tag 脚本：同步版本文件 + commit + 打 tag
    execSync(`bun run scripts/tag.ts ${tag}`, { cwd, stdio: 'inherit' })

    // 推送 main 和 tag
    execSync('git push origin main --follow-tags', { cwd, stdio: 'inherit' })

    process.stdout.write(`released ${tag} successfully\n`)
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

main()

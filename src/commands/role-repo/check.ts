import type { Scope } from '../../core/role-repo/types'
import { Args, Command, Flags } from '@oclif/core'
import { checkRoleRepos } from '../../core/role-repo/service'

export default class RoleRepoCheck extends Command {
  static description = '检查角色仓库源是否可扫描'

  static examples = [
    '$ otcc role-repo check',
    '$ otcc role-repo check official --json',
  ]

  static flags = {
    global: Flags.boolean({ char: 'g', description: '检查全局配置' }),
    json: Flags.boolean({ description: '输出 JSON' }),
  }

  static args = {
    name: Args.string({ description: '仓库别名' }),
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(RoleRepoCheck)
    const scope: Scope = flags.global ? 'global' : 'local'
    const results = await checkRoleRepos(scope, args.name)

    if (flags.json) {
      this.log(JSON.stringify(results, null, 2))
      return
    }

    if (results.length === 0) {
      this.log('没有找到任何 role repo')
      return
    }

    for (const result of results) {
      this.log(`${result.ok ? '✅' : '❌'} ${result.repo.name}`)
      this.log(`   角色数: ${result.roleCount}`)
      this.log(`   扫描时间: ${result.fetchedAt}`)
      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          this.log(`   - ${issue.path}: ${issue.message}`)
        }
      }
      this.log()
    }
  }
}

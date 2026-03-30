import type { Scope } from '../../core/role-repo/types'
import { Args, Command, Flags } from '@oclif/core'
import { updateRoleRepos } from '../../core/role-repo/service'

export default class RoleRepoUpdate extends Command {
  static description = '刷新角色仓库缓存'

  static examples = [
    '$ otcc role-repo update',
    '$ otcc role-repo update official --json',
  ]

  static flags = {
    global: Flags.boolean({ char: 'g', description: '刷新全局配置' }),
    json: Flags.boolean({ description: '输出 JSON' }),
  }

  static args = {
    name: Args.string({ description: '仓库别名' }),
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(RoleRepoUpdate)
    const scope: Scope = flags.global ? 'global' : 'local'
    const results = await updateRoleRepos(scope, args.name)

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
      this.log(`   已缓存角色: ${result.roleCount}`)
      this.log(`   更新时间: ${result.fetchedAt}`)
      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          this.log(`   - ${issue.path}: ${issue.message}`)
        }
      }
      this.log()
    }
  }
}

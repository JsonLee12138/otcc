import type { Scope } from '../../core/role-repo/types'
import { Args, Command, Flags } from '@oclif/core'
import { addRoleRepo } from '../../core/role-repo/service'

export default class RoleRepoAdd extends Command {
  static description = '添加角色仓库源'

  static examples = [
    '$ otcc role-repo add official https://github.com/example/roles',
  ]

  static flags = {
    global: Flags.boolean({ char: 'g', description: '添加到全局配置' }),
  }

  static args = {
    name: Args.string({ required: true, description: '仓库别名' }),
    url: Args.string({ required: true, description: 'GitHub 仓库地址' }),
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(RoleRepoAdd)
    const scope: Scope = flags.global ? 'global' : 'local'
    const repo = await addRoleRepo(scope, args.name, args.url)
    this.log(`✅ 已添加 role repo: ${repo.name}`)
    this.log(`   仓库: ${repo.owner}/${repo.repo}`)
    this.log(`   作用域: ${scope}`)
  }
}

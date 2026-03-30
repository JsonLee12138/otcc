import type { Scope } from '../../core/role-repo/types'
import { Args, Command, Flags } from '@oclif/core'
import inquirer from 'inquirer'
import { removeRoleRepoSource } from '../../core/role-repo/service'

export default class RoleRepoRemove extends Command {
  static description = '移除角色仓库源'

  static examples = ['$ otcc role-repo remove official']

  static flags = {
    global: Flags.boolean({ char: 'g', description: '从全局配置移除' }),
    yes: Flags.boolean({ char: 'y', description: '跳过确认' }),
  }

  static args = {
    name: Args.string({ required: true, description: '仓库别名' }),
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(RoleRepoRemove)
    const scope: Scope = flags.global ? 'global' : 'local'

    if (!flags.yes) {
      const { confirm } = await inquirer.prompt<{ confirm: boolean }>({
        type: 'confirm',
        name: 'confirm',
        message: `确认移除 role repo ${args.name} ?`,
        default: false,
      })

      if (!confirm) {
        this.log('已取消')
        return
      }
    }

    const removed = await removeRoleRepoSource(scope, args.name)
    if (!removed) {
      this.error(`未找到 role repo: ${args.name}`)
    }

    this.log(`✅ 已移除 role repo: ${args.name}`)
  }
}

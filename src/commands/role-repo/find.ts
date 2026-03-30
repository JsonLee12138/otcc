import type { Scope } from '../../core/role-repo/types'
import { Args, Command, Flags } from '@oclif/core'
import { findRoles } from '../../core/role-repo/service'

export default class RoleRepoFind extends Command {
  static description = '从角色仓库缓存中搜索角色'

  static examples = [
    '$ otcc role-repo find frontend',
    '$ otcc role-repo find --role frontend-architect --list',
  ]

  static flags = {
    global: Flags.boolean({ char: 'g', description: '搜索全局配置' }),
    role: Flags.string({
      description: '按角色名或 fileName 精确过滤',
      multiple: true,
    }),
    list: Flags.boolean({ description: '仅输出角色 fileName 列表' }),
    json: Flags.boolean({ description: '输出 JSON' }),
  }

  static args = {
    keyword: Args.string({ description: '关键字' }),
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(RoleRepoFind)
    const scope: Scope = flags.global ? 'global' : 'local'
    const roles = await findRoles(scope, {
      keyword: args.keyword,
      roleNames: flags.role,
    })

    if (flags.json) {
      this.log(JSON.stringify(roles, null, 2))
      return
    }

    if (roles.length === 0) {
      this.log('没有找到匹配的角色')
      return
    }

    if (flags.list) {
      for (const item of roles) {
        this.log(item.role.fileName)
      }
      return
    }

    this.log('=== 搜索结果 ===\n')
    for (const item of roles) {
      this.log(`📄 ${item.role.name} (${item.role.fileName})`)
      this.log(`   描述: ${item.role.description}`)
      this.log(`   来源: ${item.repo}`)
      this.log(`   路径: ${item.path}`)
      this.log(`   仓库: ${item.url}`)
      this.log()
    }
  }
}

import type { Scope } from '../../core/role-repo/types'
import { Command, Flags } from '@oclif/core'
import { listRoleRepoSources } from '../../core/role-repo/service'

export default class RoleRepoList extends Command {
  static description = '列出角色仓库源'

  static examples = ['$ otcc role-repo list', '$ otcc role-repo list --json']

  static flags = {
    global: Flags.boolean({ char: 'g', description: '仅查看全局配置' }),
    json: Flags.boolean({ description: '输出 JSON' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(RoleRepoList)
    const scope: Scope = flags.global ? 'global' : 'local'
    const repos = await listRoleRepoSources(scope)

    if (flags.json) {
      this.log(JSON.stringify(repos, null, 2))
      return
    }

    if (repos.length === 0) {
      this.log('没有找到任何 role repo')
      return
    }

    this.log('=== role repo 列表 ===\n')
    for (const repo of repos) {
      this.log(`📦 ${repo.name}`)
      this.log(`   URL: ${repo.url}`)
      this.log(`   仓库: ${repo.owner}/${repo.repo}`)
      this.log(`   分支: ${repo.branch || 'default'}`)
      this.log(`   更新时间: ${repo.updatedAt}`)
      this.log()
    }
  }
}

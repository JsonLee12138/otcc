import { Command } from '@oclif/core'
import { initClaudeMd } from '../core/init/claude'

export default class Init extends Command {
  static description = '初始化当前项目的 CLAUDE.md 角色提示块'

  static examples = ['$ otcc init']

  async run(): Promise<void> {
    const result = await initClaudeMd(process.cwd())

    if (result.action === 'created') {
      this.log('✅ 已创建 CLAUDE.md')
      return
    }

    if (result.action === 'inserted') {
      this.log('✅ 已在 CLAUDE.md 顶部插入 <!-- otcc:role -->')
      return
    }

    this.log('✅ 已更新现有 <!-- otcc:role -->')
  }
}

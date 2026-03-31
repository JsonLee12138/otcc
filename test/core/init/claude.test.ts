import { describe, expect, it } from 'bun:test'

import { applyOtccRoleBlock, buildOtccRoleBlock } from '../../../src/core/init/claude'

describe('core/init/claude', () => {
  describe('buildOtccRoleBlock', () => {
    it('uses <otcc-role> to wrap template content', () => {
      const template = '你是 OTCC init 测试角色。\n请遵循规则输出。'

      expect(buildOtccRoleBlock(template)).toBe(`<otcc-role>\n${template}\n</otcc-role>`)
    })
  })

  describe('applyOtccRoleBlock', () => {
    it("returns { action: 'created', content: block + '\\n' } when original content is null", () => {
      const block = '<otcc-role>\nnew role\n</otcc-role>'

      expect(applyOtccRoleBlock(null, block)).toEqual({
        action: 'created',
        content: `${block}\n`,
      })
    })

    it("inserts block to top and returns 'inserted' when file has normal content", () => {
      const block = '<otcc-role>\nnew role\n</otcc-role>'
      const existing = '已有普通内容\n第二行内容\n'

      expect(applyOtccRoleBlock(existing, block)).toEqual({
        action: 'inserted',
        content: `${block}\n\n${existing}`,
      })
    })

    it("replaces existing <otcc-role> block and returns 'updated'", () => {
      const block = '<otcc-role>\nnew role\n</otcc-role>'
      const existing = '<otcc-role>\nold role\n</otcc-role>\n\n已有普通内容\n'

      expect(applyOtccRoleBlock(existing, block)).toEqual({
        action: 'updated',
        content: `${block}\n\n已有普通内容\n`,
      })
    })

    it("still returns 'updated' and keeps content unchanged when block is identical", () => {
      const block = '<otcc-role>\nnew role\n</otcc-role>'
      const existing = `${block}\n\n已有普通内容\n`

      expect(applyOtccRoleBlock(existing, block)).toEqual({
        action: 'updated',
        content: existing,
      })
    })

    it('throws when start tag exists but end tag is missing', () => {
      const block = '<otcc-role>\nnew role\n</otcc-role>'
      const broken = '<otcc-role>\n损坏 block\n\n已有普通内容\n'

      expect(() => applyOtccRoleBlock(broken, block)).toThrow('检测到损坏的 <otcc-role> block')
    })
  })
})

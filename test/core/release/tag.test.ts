import { describe, expect, it } from 'bun:test'

import {
  parseReleaseTag,
  PLUGIN_VERSION_FILES,
  updateJsonVersion,
  VERSION_FILES,
} from '../../../src/core/release/tag'

describe('core/release/tag', () => {
  describe('parseReleaseTag', () => {
    it('returns normalized version for a v-prefixed tag', () => {
      expect(parseReleaseTag('v1.2.3')).toBe('1.2.3')
    })

    it('throws when tag does not match vX.Y.Z', () => {
      expect(() => parseReleaseTag('1.2.3')).toThrow('tag 必须匹配 vX.Y.Z')
      expect(() => parseReleaseTag('v1.2')).toThrow('tag 必须匹配 vX.Y.Z')
    })
  })

  describe('updateJsonVersion', () => {
    it('rewrites the version field and keeps a trailing newline', () => {
      const source = `${JSON.stringify(
        {
          name: 'otcc',
          version: '0.1.0',
        },
        null,
        2,
      )}\n`

      expect(updateJsonVersion(source, '1.2.3')).toBe(
        `${JSON.stringify(
          {
            name: 'otcc',
            version: '1.2.3',
          },
          null,
          2,
        )}\n`,
      )
    })
  })

  describe('version file constants', () => {
    it('includes package.json and both claude plugin files in VERSION_FILES', () => {
      expect(VERSION_FILES).toEqual([
        'package.json',
        '.claude-plugin/plugin.json',
        '.claude-plugin/marketplace.json',
      ])
    })

    it('keeps plugin-only files in PLUGIN_VERSION_FILES', () => {
      expect(PLUGIN_VERSION_FILES).toEqual([
        '.claude-plugin/plugin.json',
        '.claude-plugin/marketplace.json',
      ])
    })
  })
})

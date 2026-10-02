import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EFFECT_ATTRS } from './schema.js'

describe('效果图覆盖', () => {
  it('每个效果属性至少出现在一张 gallery 里', () => {
    const dir = new URL('../docs/gallery/', import.meta.url)
    const sources = readdirSync(dir)
      .filter((name) => name.endsWith('.layer'))
      .map((name) => readFileSync(new URL(name, dir), 'utf8'))
    const joined = sources.join('\n')
    for (const name of EFFECT_ATTRS) {
      expect(joined, name).toMatch(new RegExp(`(?:^|[\\s])${name}=`))
    }
  })
})
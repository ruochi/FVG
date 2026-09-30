import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from '../src/fonts.js'
import { layoutSource } from '../src/layout.js'
import { FVG_EFFECT_ATTRS } from './effects.ts'
import { renderEffectsGalleryReact } from './react/effects-gallery.tsx'
import { renderStarsPosterReact } from './react/example.tsx'
import { renderEffectsGalleryVue } from './vue/effects-gallery.ts'
import { renderStarsPosterVue } from './vue/example.ts'
import { renderBatchPosters } from './vue/posters-batch.ts'

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

const OLD_TAG = /<(row|column|circle|rect|layer|line|ellipse)\b/

describe('serialize + 生成器', () => {
  it('Vue 示例：图形用属性，组件展开成 Layer', async () => {
    const source = renderStarsPosterVue()
    expect(source).toContain('<Circle cx="40" cy="48" r="2" fill="#fff8e7" />')
    expect(source).toContain('<Layer>')
    expect(source).toContain('display: flex')
    expect(source).toContain('霜降')
    expect(source).not.toMatch(/<Caption|Caption>/)
    expect(source).not.toMatch(OLD_TAG)
    expect(source).not.toMatch(/style="[^"]*\b(fill|r|stroke):/)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'Circle')
    expect(circles.map((c) => [c.x, c.width])).toEqual([
      [38, 4],
      [116, 8],
    ])
    expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
  })

  it('Vue 城市爵士夜海报：展开 schedule 与星点', async () => {
    const { renderCityJazzPosterVue } = await import('./vue/poster-city-jazz.ts')
    const source = renderCityJazzPosterVue()
    expect(source).toContain('城市爵士夜')
    expect(source).toContain('19:30')
    expect(source).not.toMatch(/ScheduleBlock|PerkTag/)
    expect(source).not.toMatch(OLD_TAG)
    const doc = await layoutSource(source, process.cwd())
    expect(doc.root.children.filter((n) => n.tag === 'Circle').length).toBe(9)
    expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
  })

  it('React 示例：与 Vue 一样用 Circle 和 flex', async () => {
    const source = renderStarsPosterReact()
    expect(source).toContain('<Circle cx="40" cy="48" r="2" fill="#fff8e7" />')
    expect(source).toContain('<h1 style="font-size: 32px">霜降</h1>')
    expect(source).not.toMatch(/function Caption|Caption/)
    expect(source).not.toMatch(OLD_TAG)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'Circle')
    expect(circles.length).toBe(2)
    expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
  })

  it('效果总览：Vue / React 都写出全部效果属性', async () => {
    const vue = renderEffectsGalleryVue()
    const react = renderEffectsGalleryReact()
    for (const source of [vue, react]) {
      for (const attr of FVG_EFFECT_ATTRS) {
        expect(source, attr).toMatch(new RegExp(`\\b${attr}="`))
      }
      expect(source).toContain('glass="clear"')
      expect(source).toContain('glass="thick"')
      expect(source).toMatch(/shadow:\s*12 16 0 #ff5aa5/)
      expect(source).not.toMatch(OLD_TAG)
      const doc = await layoutSource(source, process.cwd())
      expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
      expect(doc.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    }
  })

  it('十张海报没有旧标签，布局不报 unknown-tag', async () => {
    const posters = renderBatchPosters()
    expect(posters).toHaveLength(10)
    for (const poster of posters) {
      expect(poster.source, poster.id).not.toMatch(OLD_TAG)
      expect(poster.source, poster.id).not.toMatch(/style="[^"]*\b(fill|r|stroke):/)
      const doc = await layoutSource(poster.source, process.cwd())
      const unknown = doc.issues.filter((issue) => issue.code === 'unknown-tag')
      expect(unknown, poster.id).toEqual([])
    }
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from '../src/fonts.js'
import { layoutSource } from '../src/layout.js'
import { renderDrawPanelReact } from './react/draw-example.tsx'
import { renderStarsPosterReact } from './react/example.tsx'
import { renderDrawPanelVue } from './vue/draw-example.ts'
import { renderStarsPosterVue } from './vue/example.ts'
import { renderBatchPosters } from './vue/posters-batch.ts'

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'flexlayer', 'fonts'), '/tmp/flexlayer-test']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

const UPPER_TAG = /<(Layer|Rect|Circle|Ellipse|Line|Arrow|Polyline|Polygon|Path|Curve)\b/

describe('serialize + 生成器', () => {
  it('Vue 示例：图形用属性，组件展开成 layer', async () => {
    const source = renderStarsPosterVue()
    expect(source).toContain('<circle cx="40" cy="48" r="2" fill="#fff8e7" />')
    expect(source).toContain('<layer>')
    expect(source).toContain('display: flex')
    expect(source).toContain('霜降')
    expect(source).not.toMatch(/<Caption|Caption>/)
    expect(source).not.toMatch(UPPER_TAG)
    expect(source).not.toMatch(/style="[^"]*\b(fill|r|stroke):/)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'circle')
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
    expect(source).not.toMatch(UPPER_TAG)
    const doc = await layoutSource(source, process.cwd())
    expect(doc.root.children.filter((n) => n.tag === 'circle').length).toBe(9)
    expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
  })

  it('React 示例：与 Vue 一样用 Circle 和 flex', async () => {
    const source = renderStarsPosterReact()
    expect(source).toContain('<circle cx="40" cy="48" r="2" fill="#fff8e7" />')
    expect(source).toContain('<h1 style="font-size: 32px">霜降</h1>')
    expect(source).not.toMatch(/function Caption|Caption/)
    expect(source).not.toMatch(UPPER_TAG)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'circle')
    expect(circles.length).toBe(2)
    expect(doc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
  })

  it('Vue/React <draw> 原样写出比较符，嵌套 layer 无 background', async () => {
    const vue = renderDrawPanelVue()
    const react = renderDrawPanelReact()
    for (const source of [vue, react]) {
      expect(source).toContain('<draw>')
      expect(source).toContain('el.w < 200')
      expect(source).not.toContain('el.w &lt; 200')
      expect(source).not.toMatch(/<layer[^>]*background="[^"]+"[^>]*>[\s\S]*<layer[^>]*background=/)
      const doc = await layoutSource(source, process.cwd())
      expect(doc.issues.filter((i) => i.code === 'invalid-draw' || i.code === 'unknown-tag')).toEqual([])
      expect(typeof doc.root.children.find((n) => n.tag === 'layer')?.draw).toBe('function')
    }
  })

  it('十张海报没有旧标签，布局不报 unknown-tag', async () => {
    const posters = renderBatchPosters()
    expect(posters).toHaveLength(10)
    for (const poster of posters) {
      expect(poster.source, poster.id).not.toMatch(UPPER_TAG)
      expect(poster.source, poster.id).not.toMatch(/style="[^"]*\b(fill|r|stroke):/)
      const doc = await layoutSource(poster.source, process.cwd())
      const unknown = doc.issues.filter((issue) => issue.code === 'unknown-tag')
      expect(unknown, poster.id).toEqual([])
    }
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from '../src/fonts.js'
import { layoutSource } from '../src/layout.js'
import { renderStarsPosterReact } from './react/example.tsx'
import { renderStarsPosterVue } from './vue/example.ts'

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('serialize + 生成器', () => {
  it('Vue 示例：小写标签、组件展开、circle 布局', async () => {
    const source = renderStarsPosterVue()
    expect(source).toContain('<circle cx="40" cy="48"')
    expect(source).toContain('<column style="gap: 8px')
    expect(source).toContain('霜降')
    expect(source).not.toMatch(/<Caption|Caption>/)
    expect(source).not.toMatch(/<Circle|<Column/)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'circle')
    expect(circles.map((c) => [c.x, c.width])).toEqual([
      [38, 4],
      [116, 8],
    ])
  })

  it('React 示例：与 Vue 等价的结构与布局', async () => {
    const source = renderStarsPosterReact()
    expect(source).toContain('<circle cx="40" cy="48"')
    expect(source).toContain('<h1 style="font-size: 32px">霜降</h1>')
    expect(source).not.toMatch(/function Caption|Caption/)

    const doc = await layoutSource(source, process.cwd())
    const circles = doc.root.children.filter((n) => n.tag === 'circle')
    expect(circles.length).toBe(2)
  })
})

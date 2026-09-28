import { beforeAll, describe, expect, it } from 'vitest'
import { loadImage } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFvg, type FvgNode } from './parse.js'
import { initFontsForMeasure } from './fonts.js'
import { debugFvg } from './render.js'
import { guideAxes, guideSegments } from './debug.js'
import type { FvgReport } from './types.js'
import { layoutSource } from './layout.js'
import { buildReport } from './report.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const helloPath = join(pkgDir, 'examples', 'hello.fvg')

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('parse line numbers', () => {
  it('注释保留行号', () => {
    const source = ['<Layer>', '<!-- comment -->', '<p>hi</p>', '</Layer>'].join('\n')
    const nodes = parseFvg(source)
    const layer = nodes[0]!
    expect(layer.line).toBe(1)
    const p = layer.children.find((c): c is FvgNode => typeof c !== 'string' && c.tag === 'p')
    expect(p?.line).toBe(3)
  })
})

describe('debugFvg', () => {
  it('报告元素带 line', async () => {
    const source = await readFile(helloPath, 'utf8')
    const doc = await layoutSource(source, join(pkgDir, 'examples'))
    const report = buildReport(doc)
    expect(report.elements.length).toBeGreaterThan(0)
    for (const el of report.elements) {
      expect(el.line).toBeGreaterThan(0)
    }
  })

  it('index.md 含问题、编号与行号', async () => {
    const source = await readFile(helloPath, 'utf8')
    const { index } = await debugFvg(source, {
      baseDir: join(pkgDir, 'examples'),
      sourceName: 'hello.fvg',
    })
    expect(index).toContain('## 问题')
    expect(index).toContain('## 元素')
    expect(index).toMatch(/\| 0 \|/)
    expect(index).toMatch(/L\d+/)
  })

  it('debug.png 只画横纵线，尺寸与原图相同', async () => {
    const source = await readFile(helloPath, 'utf8')
    const { renderPng, debugPng, report } = await debugFvg(source, {
      baseDir: join(pkgDir, 'examples'),
      scale: 0.5,
    })
    const render = await loadImage(renderPng)
    const debug = await loadImage(debugPng)
    expect(debug.width).toBe(render.width)
    expect(debug.height).toBe(render.height)
    expect(renderPng.equals(debugPng)).toBe(false)
    const guides = guideAxes(report)
    expect(guides.x.length).toBeGreaterThan(2)
    expect(guides.y.length).toBeGreaterThan(2)
    const gaps: number[] = []
    for (let i = 1; i < guides.y.length; i++) gaps.push(guides.y[i]! - guides.y[i - 1]!)
    expect(gaps.some((d) => Math.abs(d - 32) < 1)).toBe(true)
  })

  it('线只伸向离元素更近的一侧', () => {
    const report = {
      width: 100,
      height: 100,
      elements: [
        {
          box: {
            x: 10,
            y: 60,
            width: 20,
            height: 20,
            left: 10,
            right: 30,
            top: 60,
            bottom: 80,
            centerX: 20,
            centerY: 70,
          },
        },
      ],
    } as FvgReport
    const segs = guideSegments(report)
    const horizontal = segs.filter((s) => s.axis === 'h')
    const vertical = segs.filter((s) => s.axis === 'v')
    expect(horizontal).toHaveLength(2)
    expect(horizontal.every((s) => s.from === 0 && s.to === 30)).toBe(true)
    expect(vertical).toHaveLength(2)
    expect(vertical.every((s) => s.from === 60 && s.to === 100)).toBe(true)
  })

  it('focus 裁图与 id 解析', async () => {
    const source = await readFile(helloPath, 'utf8')
    const { focus, report } = await debugFvg(source, {
      baseDir: join(pkgDir, 'examples'),
      focus: ['0'],
    })
    expect(focus.length).toBe(1)
    expect(focus[0]?.n).toBe(0)
    const focusPx = await loadImage(focus[0]!.png)
    expect(focusPx.width).toBeGreaterThan(0)
    expect(focusPx.height).toBeGreaterThan(0)
    expect(Math.max(focusPx.width, focusPx.height)).toBeLessThanOrEqual(1024)
    const withId = report.elements.find((e) => e.id)
    if (withId?.id) {
      const byId = await debugFvg(source, {
        baseDir: join(pkgDir, 'examples'),
        focus: [withId.id],
      })
      expect(byId.focus[0]?.n).toBe(report.elements.indexOf(withId))
    }
  })
})

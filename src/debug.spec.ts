import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFvg, type FvgNode } from './parse.js'
import { initFontsForMeasure } from './fonts.js'
import { debugFvg } from './render.js'
import { layoutSource } from './layout.js'
import { buildReport } from './report.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const helloPath = join(pkgDir, 'examples', 'hello.fvg')

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

async function pixelSampler(png: Buffer) {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return (x: number, y: number) => {
    const p = ctx.getImageData(x, y, 1, 1).data
    return [p[0]!, p[1]!, p[2]!] as const
  }
}

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

  it('debug.png 与 render.png 不同且含网格线', async () => {
    const source = await readFile(helloPath, 'utf8')
    const { renderPng, debugPng } = await debugFvg(source, {
      baseDir: join(pkgDir, 'examples'),
      scale: 0.5,
    })
    expect(renderPng.equals(debugPng)).toBe(false)
    const sampleRender = await pixelSampler(renderPng)
    const sampleDebug = await pixelSampler(debugPng)
    const x = 50
    expect(sampleRender(x, 0)).not.toEqual(sampleDebug(x, 0))
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

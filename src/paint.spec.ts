import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { h } from './h.js'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('paint containers', () => {
  it('Column 子元素画在 Column 的位置上', async () => {
    const root = h(
      'fvg',
      { width: '200', height: '200', background: '#000000' },
      h(
        'Column',
        { cx: '100', cy: '100', anchor: 'center', style: 'width:80px' },
        h('div', { style: 'width:80px; height:40px; background:#ffffff' }, 'A'),
      ),
    )
    const { png } = await renderFvg(root)
    const img = await loadImage(png)
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const mid = ctx.getImageData(100, 100, 1, 1).data
    const origin = ctx.getImageData(10, 10, 1, 1).data
    expect(mid[0]).toBeGreaterThan(200)
    expect(origin[0]).toBeLessThan(20)
  })

  it('stroke="none" 的多边形只填充，不描边', async () => {
    const root = h(
      'fvg',
      { width: '100', height: '100', background: '#ffffff' },
      h('Polygon', { points: '20,20 80,20 80,80 20,80', fill: '#ff0000', stroke: 'none', 'stroke-width': '12' }),
    )
    const { png } = await renderFvg(root)
    const img = await loadImage(png)
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const outside = ctx.getImageData(16, 50, 1, 1).data
    const inside = ctx.getImageData(50, 50, 1, 1).data
    expect(outside[0]).toBeGreaterThan(240)
    expect(outside[1]).toBeGreaterThan(240)
    expect(inside[0]).toBeGreaterThan(240)
    expect(inside[1]).toBeLessThan(20)
  })
})

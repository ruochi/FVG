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

async function pixelAt(png: Buffer, x: number, y: number) {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(x, y, 1, 1).data
}

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
    const mid = await pixelAt(png, 100, 100)
    const origin = await pixelAt(png, 10, 10)
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
    const outside = await pixelAt(png, 16, 50)
    const inside = await pixelAt(png, 50, 50)
    expect(outside[0]).toBeGreaterThan(240)
    expect(outside[1]).toBeGreaterThan(240)
    expect(inside[0]).toBeGreaterThan(240)
    expect(inside[1]).toBeLessThan(20)
  })

  it('Layer 的 rotate 带着子元素绕中心转', async () => {
    const root = h(
      'fvg',
      { width: '200', height: '200', background: '#000000' },
      h(
        'Layer',
        { cx: '100', cy: '100', width: '100', height: '100', rotate: '90' },
        h('Rect', { x1: '0', y1: '10', x2: '100', y2: '30', fill: '#ffffff' }),
      ),
    )
    const { png } = await renderFvg(root)
    // 层中心 (100,100)，顶边横条顺时针 90° 后落到 x=120..140
    const moved = await pixelAt(png, 130, 100)
    const vacated = await pixelAt(png, 100, 70)
    expect(moved[0]).toBeGreaterThan(200)
    expect(vacated[0]).toBeLessThan(20)
  })

  it('Layer 的 scale 带着子元素一起缩放', async () => {
    const root = h(
      'fvg',
      { width: '200', height: '200', background: '#000000' },
      h(
        'Layer',
        { cx: '100', cy: '100', width: '100', height: '100', scale: '2' },
        h('Rect', { cx: '50', cy: '50', width: '20', height: '20', fill: '#ffffff' }),
      ),
    )
    const { png } = await renderFvg(root)
    // 20px 方块绕 (100,100) 放大 2 倍，覆盖到 x=80
    const grown = await pixelAt(png, 85, 100)
    const stillOut = await pixelAt(png, 70, 100)
    expect(grown[0]).toBeGreaterThan(200)
    expect(stillOut[0]).toBeLessThan(20)
  })

  it('origin=top-left 时绕左上角旋转', async () => {
    const root = h(
      'fvg',
      { width: '220', height: '160', background: '#000000' },
      h(
        'Layer',
        { cx: '100', cy: '20', anchor: 'top-left', width: '100', height: '100', rotate: '90', origin: 'top-left' },
        h('Rect', { x1: '0', y1: '40', x2: '10', y2: '80', fill: '#ffffff' }),
      ),
    )
    const { png } = await renderFvg(root)
    // 绕层的左上角 (100,20) 顺时针 90° 后，竖条变成 y=20 处的横条
    const moved = await pixelAt(png, 40, 25)
    const vacated = await pixelAt(png, 105, 80)
    expect(moved[0]).toBeGreaterThan(200)
    expect(vacated[0]).toBeLessThan(20)
  })

  it('overflow=hidden 裁掉超出 Layer 的部分', async () => {
    const root = h(
      'fvg',
      { width: '200', height: '100', background: '#000000' },
      h(
        'Layer',
        { cx: '0', cy: '0', anchor: 'top-left', width: '100', height: '100', overflow: 'hidden' },
        h('Rect', { cx: '90', cy: '50', width: '40', height: '40', fill: '#ffffff' }),
      ),
    )
    const { png } = await renderFvg(root)
    const inside = await pixelAt(png, 95, 50)
    const clipped = await pixelAt(png, 105, 50)
    expect(inside[0]).toBeGreaterThan(200)
    expect(clipped[0]).toBeLessThan(20)
  })

  it('文字和线条的 rotate、scale 生效', async () => {
    const text = h(
      'fvg',
      { width: '200', height: '200', background: '#000000' },
      h('div', { cx: '100', cy: '100', rotate: '90', style: 'width:120px; height:20px; background:#ffffff' }, 'A'),
    )
    const textPng = await renderFvg(text)
    expect((await pixelAt(textPng.png, 100, 50))[0]).toBeGreaterThan(200)
    expect((await pixelAt(textPng.png, 50, 100))[0]).toBeLessThan(20)

    const line = h(
      'fvg',
      { width: '200', height: '200', background: '#000000' },
      h('Line', { x1: '70', y1: '100', x2: '130', y2: '100', stroke: '#ffffff', 'stroke-width': '2', scale: '5' }),
    )
    const linePng = await renderFvg(line)
    expect((await pixelAt(linePng.png, 100, 96))[0]).toBeGreaterThan(200)
  })

  it('空 div 色块不报 text-overflow', async () => {
    const root = h(
      'fvg',
      { width: '120', height: '80', background: '#000000' },
      h('Layer', { cx: '10', cy: '10', anchor: 'top-left' }, h('Row', { style: 'gap:8px' }, h('div', { style: 'width:28px; height:28px; background:#ffffff' }))),
    )
    const { png, report } = await renderFvg(root)
    expect(report.issues.some((issue) => issue.code === 'text-overflow')).toBe(false)
    expect((await pixelAt(png, 20, 24))[0]).toBeGreaterThan(200)
  })

  it('flex:1 的分隔线占满剩余宽度', async () => {
    const root = h(
      'fvg',
      { width: '300', height: '80', background: '#000000' },
      h(
        'Layer',
        { cx: '10', cy: '30', anchor: 'top-left' },
        h(
          'Row',
          { style: 'width:280px; gap:8px; align-items:center' },
          h('p', { style: 'font-size:32px; color:#ffffff' }, '左'),
          h('div', { style: 'flex:1; height:4px; background:#ffffff' }),
          h('p', { style: 'font-size:32px; color:#ffffff' }, '右'),
        ),
      ),
    )
    const { png, report } = await renderFvg(root)
    expect(report.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect((await pixelAt(png, 150, 48))[0]).toBeGreaterThan(200)
  })

  it('直接定位的 Row 和包一层 Layer 画出来一样', async () => {
    const row = h('Row', { style: 'gap:12px; align-items:center' }, h('p', { style: 'font-size:32px; color:#ffffff' }, '甲乙'))
    const direct = h('fvg', { width: '400', height: '120', background: '#000000' }, h('Row', { cx: '20', cy: '30', anchor: 'top-left', style: 'gap:12px; align-items:center' }, h('p', { style: 'font-size:32px; color:#ffffff' }, '甲乙')))
    const wrapped = h('fvg', { width: '400', height: '120', background: '#000000' }, h('Layer', { cx: '20', cy: '30', anchor: 'top-left' }, row))
    const a = await renderFvg(direct)
    const b = await renderFvg(wrapped)
    const pa = await pixelAt(a.png, 30, 40)
    const pb = await pixelAt(b.png, 30, 40)
    expect(Array.from(pa)).toEqual(Array.from(pb))
  })
})

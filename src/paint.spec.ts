import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

const fontsCacheDir = join(homedir(), '.cache', 'fvg', 'fonts')

beforeAll(async () => {
  for (const dir of [fontsCacheDir, '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

async function render(source: string, scale = 1) {
  const { png } = await renderFvg(source, { fontsCacheDir, scale })
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return (x: number, y: number): [number, number, number] => {
    const p = ctx.getImageData(x, y, 1, 1).data
    return [p[0]!, p[1]!, p[2]!]
  }
}

const scene = (body: string) => `<fvg style="width:200px; height:200px; background:#000000">${body}</fvg>`

describe('paint', () => {
  it('row/column 里的图形画在容器所在的位置', async () => {
    const px = await render(
      scene(`<column cx="150" cy="150" anchor="center" style="width:40px; height:40px"><rect style="width:40px; height:40px; fill:#ff0000" /></column>`),
    )
    expect(px(150, 150)[0]).toBeGreaterThan(200)
    expect(px(150, 150)[1]).toBeLessThan(30)
    expect(px(2, 2)[0]).toBeLessThan(10)
  })

  it('阴影画在偏移之后的位置，本体下面', async () => {
    const px = await render(scene(`<rect cx="60" cy="100" style="width:40px; height:40px; fill:#0000ff; shadow:60px 0 0 #ff0000" />`))
    expect(px(60, 100)).toEqual([0, 0, 255])
    expect(px(120, 100)[0]).toBeGreaterThan(240)
    expect(px(180, 100)[0]).toBeLessThan(10)
  })

  it('光晕出现在圆外，没写光晕时圆外是背景', async () => {
    const withGlow = await render(scene(`<circle cx="100" cy="100" style="r:40px; fill:#ffffff; glow:12px" />`))
    const without = await render(scene(`<circle cx="100" cy="100" style="r:40px; fill:#ffffff" />`))
    expect(withGlow(100, 56)[0]).toBeGreaterThan(40)
    expect(without(100, 56)[0]).toBe(0)
  })

  it('opacity 把阴影一起调淡', async () => {
    const full = await render(scene(`<rect cx="60" cy="100" style="width:40px; height:40px; fill:#0000ff; shadow:60px 0 0 #ff0000" />`))
    const half = await render(scene(`<rect cx="60" cy="100" style="width:40px; height:40px; fill:#0000ff; opacity:0.5; shadow:60px 0 0 #ff0000" />`))
    expect(half(120, 100)[0]).toBeLessThan(full(120, 100)[0] * 0.6)
    expect(half(120, 100)[0]).toBeGreaterThan(full(120, 100)[0] * 0.4)
  })

  it('旋转后阴影偏移跟着转', async () => {
    const px = await render(scene(`<rect cx="100" cy="60" style="width:30px; height:30px; fill:#0000ff; rotate:90; shadow:60px 0 0 #ff0000" />`))
    expect(px(100, 120)[0]).toBeGreaterThan(240)
    expect(px(160, 60)[0]).toBeLessThan(10)
  })

  it('导出倍率改变时阴影偏移一起缩放', async () => {
    const px = await render(scene(`<rect cx="60" cy="100" style="width:40px; height:40px; fill:#0000ff; shadow:60px 0 0 #ff0000" />`), 0.5)
    expect(px(60, 50)[0]).toBeGreaterThan(240)
    expect(px(30, 50)).toEqual([0, 0, 255])
  })

  it('Path 按自己的坐标画', async () => {
    const px = await render(scene(`<path d="M 140 140 L 180 140 L 180 180 L 140 180 Z" style="fill:#ff0000; stroke:#ff0000; stroke-width:1px" />`))
    expect(px(160, 160)[0]).toBeGreaterThan(240)
    expect(px(40, 40)[0]).toBeLessThan(10)
  })
})

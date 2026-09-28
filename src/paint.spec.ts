import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'
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

  it('文字绕中心旋转，字形跟着转，布局盒子不变', async () => {
    const body = `<p cx="100" cy="100" style="font-size:28px; color:#ffffff; white-space:nowrap; rotate:90">HHHHHH</p>`
    const flat = scene(body.replace(' rotate:90', ''))
    const turned = scene(body)
    const doc = await layoutSource(turned, process.cwd())
    const node = doc.root.children[0]!
    expect(node.rotate).toBe(90)
    expect(node.width).toBeGreaterThan(node.height + 8)
    const flatDoc = await layoutSource(flat, process.cwd())
    expect(flatDoc.root.children[0]?.width).toBe(node.width)
    expect(flatDoc.root.children[0]?.height).toBe(node.height)
    const count = async (source: string, axis: 'x' | 'y') => {
      const px = await render(source)
      let n = 0
      for (let i = 0; i < 200; i++) {
        const [r, g, b] = axis === 'x' ? px(i, 100) : px(100, i)
        if (r + g + b > 400) n++
      }
      return n
    }
    expect(await count(flat, 'x')).toBeGreaterThan(await count(flat, 'y'))
    expect(await count(turned, 'y')).toBeGreaterThan(await count(turned, 'x'))
  })

  it('文字和容器的背景绕中心缩放，盒子外的像素不动', async () => {
    const px = await render(
      scene(`<p cx="100" cy="100" style="width:80px; height:40px; background:#ff0000; color:#ff0000; scale:0.5">A</p>`),
    )
    expect(px(100, 100)[0]).toBeGreaterThan(200)
    expect(px(68, 100)[0]).toBeLessThan(15)
    const col = await render(
      scene(
        `<column cx="100" cy="100" style="width:80px; height:24px; rotate:90"><rect style="width:80px; height:24px; fill:#00ff00" /></column>`,
      ),
    )
    expect(col(100, 130)[1]).toBeGreaterThan(200)
    expect(col(130, 100)[1]).toBeLessThan(15)
  })

  it('文字旋转后阴影偏移跟着转', async () => {
    const px = await render(
      scene(`<p cx="100" cy="60" style="width:30px; height:30px; background:#0000ff; rotate:90; shadow:60px 0 0 #ff0000">A</p>`),
    )
    expect(px(100, 120)[0]).toBeGreaterThan(240)
    expect(px(160, 60)[0]).toBeLessThan(10)
  })

  it('形状描边落在盒子内，着墨等于盒子', async () => {
    const source = scene(
      `<rect cx="100" cy="100" style="width:60px; height:40px; fill:#0000ff; stroke:#ffff00; stroke-width:10px" />`,
    )
    const doc = await layoutSource(source, process.cwd())
    const shape = doc.root.children[0]
    expect(shape?.kind).toBe('shape')
    if (shape?.kind !== 'shape') return
    expect(shape.x).toBe(70)
    expect(shape.width).toBe(60)
    expect(shape.ink).toEqual({ x: 0, y: 0, width: 60, height: 40 })
    const px = await render(source)
    expect(px(66, 100)[0] + px(66, 100)[1]).toBeLessThan(20)
    expect(px(74, 100)[0]).toBeGreaterThan(240)
    expect(px(74, 100)[1]).toBeGreaterThan(240)
    expect(px(100, 100)).toEqual([0, 0, 255])
    const circle = await render(scene(`<circle cx="100" cy="100" style="r:30px; fill:none; stroke:#ffff00; stroke-width:10px" />`))
    expect(circle(100, 66)[1]).toBeLessThan(15)
    expect(circle(100, 74)[0]).toBeGreaterThan(240)
    expect(circle(100, 74)[1]).toBeGreaterThan(240)
    const ellipse = await render(
      scene(`<ellipse cx="100" cy="100" style="rx:40px; ry:20px; fill:none; stroke:#ffff00; stroke-width:8px" />`),
    )
    expect(ellipse(100, 76)[1]).toBeLessThan(15)
    expect(ellipse(100, 84)[0]).toBeGreaterThan(240)
  })

  it('圆角边框和直角边框都画在盒子内部', async () => {
    const rounded = await render(
      scene(
        `<row cx="100" cy="100" style="width:80px; height:40px; background:#111111; border:10px solid #ff00ff; border-radius:16px"></row>`,
      ),
    )
    expect(rounded(100, 76)[0]).toBeLessThan(15)
    expect(rounded(100, 84)[0]).toBeGreaterThan(200)
    expect(rounded(100, 84)[2]).toBeGreaterThan(200)
    const square = await render(
      scene(`<row cx="100" cy="100" style="width:80px; height:40px; background:#111111; border:10px solid #ff00ff"></row>`),
    )
    expect(square(100, 76)[0]).toBeLessThan(15)
    expect(square(100, 84)[0]).toBeGreaterThan(200)
    expect(square(100, 84)[2]).toBeGreaterThan(200)
  })

  it('curve 穿过点，开口不填，闭合才填，两个点是直线', async () => {
    const smooth = await render(
      scene(`<curve points="30,100 100,40 170,100" style="fill:#ff0000; stroke:#ffff00; stroke-width:4" />`),
    )
    expect(smooth(100, 40)[0]).toBeGreaterThan(200)
    expect(smooth(100, 40)[1]).toBeGreaterThan(200)
    expect(smooth(100, 100)[0]).toBeLessThan(20)
    const closed = await render(
      scene(`<curve points="40,40 160,40 100,150" closed style="fill:#ff0000; stroke:none" />`),
    )
    expect(closed(100, 80)[0]).toBeGreaterThan(200)
    const straight = await render(scene(`<curve points="40,100 160,100" style="stroke:#00ff00; stroke-width:6" />`))
    expect(straight(100, 100)[1]).toBeGreaterThan(200)
    expect(straight(100, 80)[1]).toBeLessThan(15)
  })

  it('curve 绕中心旋转', async () => {
    const px = await render(scene(`<curve points="40,100 160,100" style="stroke:#ff0000; stroke-width:8; rotate:90" />`))
    expect(px(100, 150)[0]).toBeGreaterThan(200)
    expect(px(150, 100)[0]).toBeLessThan(15)
  })

  it('transform-origin 决定旋转钉住的点', async () => {
    const px = await render(
      scene(`<rect cx="100" cy="100" style="width:60px; height:16px; fill:#ff0000; rotate:90; transform-origin:bottom" />`),
    )
    expect(px(108, 108)[0]).toBeGreaterThan(200)
    expect(px(100, 70)[0]).toBeLessThan(15)
  })
})

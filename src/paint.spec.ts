import { createCanvas, loadImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { renderFvg } from './render.js'

async function pixel(png: Buffer, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(x, y, 1, 1).data
  return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0 }
}

const black = (p: { r: number; g: number; b: number }) => p.r < 16 && p.g < 16 && p.b < 16
const white = (p: { r: number; g: number; b: number }) => p.r > 240 && p.g > 240 && p.b > 240

describe('paint transform-origin', () => {
  it('像素原点缩放时钉在左上角', async () => {
    const { png } = await renderFvg(
      `<fvg width="100" height="100" background="#ffffff"><Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000000" scale="2" transform-origin="0 0" /></fvg>`,
      { baseDir: process.cwd() },
    )
    expect(white(await pixel(png, 2, 20))).toBe(true)
    expect(black(await pixel(png, 15, 20))).toBe(true)
  })

  it('默认原点是盒子中心', async () => {
    const { png } = await renderFvg(
      `<fvg width="100" height="100" background="#ffffff"><Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000000" scale="2" /></fvg>`,
      { baseDir: process.cwd() },
    )
    expect(black(await pixel(png, 2, 20))).toBe(true)
  })

  it('子元素跟着 Layer 的像素原点旋转', async () => {
    const { png } = await renderFvg(
      `<fvg width="100" height="100" background="#ffffff"><Layer width="40" height="10" cx="20" cy="20" anchor="top-left" rotate="90" transform-origin="0px 0px"><Rect width="40" height="10" cx="0" cy="0" anchor="top-left" fill="#000000" /></Layer></fvg>`,
      { baseDir: process.cwd() },
    )
    expect(black(await pixel(png, 15, 40))).toBe(true)
    expect(white(await pixel(png, 30, 40))).toBe(true)
  })

  it('Layer 的位置会作用到子元素', async () => {
    const { png } = await renderFvg(
      `<fvg width="100" height="100" background="#ffffff"><Layer width="30" height="30" cx="70" cy="70" anchor="top-left"><Rect width="10" height="10" cx="0" cy="0" anchor="top-left" fill="#000000" /></Layer></fvg>`,
      { baseDir: process.cwd() },
    )
    expect(black(await pixel(png, 72, 72))).toBe(true)
    expect(white(await pixel(png, 2, 2))).toBe(true)
  })
})

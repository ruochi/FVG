import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: join(homedir(), '.cache', 'fvg', 'fonts') })
})

async function pixels(png: Buffer) {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  const at = (x: number, y: number) => {
    const i = (y * img.width + x) * 4
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const
  }
  return { at, width: img.width, height: img.height }
}

describe('绘制', () => {
  it('Path 画在路径坐标上，不再叠加盒子偏移', async () => {
    const { png } = await renderFvg(
      `<fvg width="200" height="200" background="#ffffff"><Path d="M 80 90 L 140 90" stroke="#0000ff" stroke-width="4" /></fvg>`,
    )
    const { at } = await pixels(png)
    const onLine = at(100, 90)
    const doubled = at(160, 180)
    expect(onLine[2]).toBeGreaterThan(200)
    expect(doubled[0]).toBeGreaterThan(240)
    expect(doubled[2]).toBeGreaterThan(240)
  })

  it('夜空渐变上深下浅，月晕染到圆的外面', async () => {
    const { png } = await renderFvg(
      `<fvg width="120" height="120" background="#ffffff"><Rect x="0" y="0" width="120" height="120" fill="linear-gradient(#102038, #d8e2ea)" /><Circle cx="60" cy="60" r="16" fill="#f4efe4" glow="18 #f4efe4" /></fvg>`,
    )
    const { at } = await pixels(png)
    expect(at(10, 8)[2]).toBeGreaterThan(at(10, 8)[0])
    expect(at(10, 110)[0]).toBeGreaterThan(at(10, 8)[0])
    const halo = at(60, 36)
    const sky = at(8, 36)
    expect(halo[0]).toBeGreaterThan(sky[0] + 20)
  })

  it('同一 symbol 可以摆两次', async () => {
    const { png } = await renderFvg(
      `<fvg width="80" height="40" background="#ffffff"><symbol id="dot"><Circle cx="8" cy="8" r="6" fill="#ff0000" /></symbol><use href="#dot" cx="16" cy="20" /><use href="#dot" cx="56" cy="20" /></fvg>`,
    )
    const { at } = await pixels(png)
    expect(at(16, 20)[0]).toBeGreaterThan(200)
    expect(at(56, 20)[0]).toBeGreaterThan(200)
    expect(at(36, 20)[0]).toBeGreaterThan(240)
  })
})

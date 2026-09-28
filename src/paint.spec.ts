import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

async function pixel(png: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const p = ctx.getImageData(x, y, 1, 1).data
  return [p[0]!, p[1]!, p[2]!]
}

describe('paint', () => {
  it('Row/Column 里的图形画在容器所在的位置', async () => {
    const { png } = await renderFvg(
      `<fvg width="200" height="200" background="#000000"><Column cx="150" cy="150" anchor="center" style="width:40px; height:40px"><Rect width="40" height="40" fill="#ff0000" /></Column></fvg>`,
      { fontsCacheDir: join(homedir(), '.cache', 'fvg', 'fonts') },
    )
    const center = await pixel(png, 150, 150)
    const origin = await pixel(png, 2, 2)
    expect(center[0]).toBeGreaterThan(200)
    expect(center[1]).toBeLessThan(30)
    expect(origin[0]).toBeLessThan(10)
  })
})

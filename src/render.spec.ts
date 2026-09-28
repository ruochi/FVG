import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const fonts = join(homedir(), '.cache', 'fvg', 'fonts')

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: fonts })
})

async function pixels(png: Buffer) {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  return {
    width: img.width,
    height: img.height,
    at(x: number, y: number) {
      const i = (y * img.width + x) * 4
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const
    },
  }
}

describe('render placement', () => {
  it('hello 的标签画在中部，不贴在左上角', async () => {
    const source = await readFile(join(pkgDir, 'examples/hello.fvg'), 'utf8')
    const { png } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    const img = await pixels(png)
    let minY = img.height
    let maxY = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x += 2) {
        const [r, g, b] = img.at(x, y)
        if (r > 200 && g > 100 && g < 190 && b < 60) {
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    expect(minY).toBeGreaterThan(400)
    expect(maxY).toBeGreaterThan(1100)
  })

  it('线条留在写出的坐标上', async () => {
    const source = await readFile(join(pkgDir, 'examples/layer-shapes.fvg'), 'utf8')
    const { png } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    const img = await pixels(png)
    const arrow = img.at(350, 200)
    const line = img.at(400, 400)
    const gap = img.at(400, 300)
    expect(arrow[0]).toBeLessThan(80)
    expect(line[0]).toBeGreaterThan(180)
    expect(line[0]).toBeLessThan(230)
    expect(gap[0]).toBeGreaterThan(250)
    expect(gap[1]).toBeGreaterThan(250)
    expect(gap[2]).toBeGreaterThan(250)
  })

  it('卡片文字画在画面中部', async () => {
    const source = await readFile(join(pkgDir, 'examples/card-row.fvg'), 'utf8')
    const { png, report } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    expect(report.issues.some((issue) => issue.code === 'min-font-size')).toBe(false)
    const img = await pixels(png)
    let minY = img.height
    let maxY = 0
    let count = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x += 2) {
        const [r, g, b] = img.at(x, y)
        const dark = r < 80 && g < 80 && b < 80
        const orange = r > 200 && g > 100 && g < 190 && b < 80
        if (dark || orange) {
          count++
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    expect(count).toBeGreaterThan(20)
    expect(minY).toBeGreaterThan(200)
    expect((minY + maxY) / 2).toBeGreaterThan(300)
    expect((minY + maxY) / 2).toBeLessThan(500)
  })
})

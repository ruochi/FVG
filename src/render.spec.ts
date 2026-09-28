import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'
import { pixelsFromPng } from './testPixels.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const fonts = join(homedir(), '.cache', 'fvg', 'fonts')

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: fonts })
})

describe('render placement', () => {
  it('虚线、平头和旋转能画出来', async () => {
    const source = `<fvg width="220" height="220" background="#ffffff" color="#000000">
      <Line x1="20" y1="20" x2="200" y2="20" stroke-width="4" stroke-dasharray="12 12" />
      <Line x1="30" y1="70" x2="190" y2="70" stroke-width="20" stroke-linecap="butt" />
      <Row cx="110" cy="150" rotate="90" style="width:100px; height:16px; background:#000000" />
    </fvg>`
    const { png } = await renderFvg(source, { fontsCacheDir: fonts })
    const img = await pixelsFromPng(png)
    let dark = 0
    let light = 0
    for (let x = 30; x < 190; x++) {
      const [r] = img.at(x, 20)
      if (r < 40) dark++
      else light++
    }
    expect(dark).toBeGreaterThan(20)
    expect(light).toBeGreaterThan(20)
    const cap = img.at(22, 70)
    expect(cap[0]).toBeGreaterThan(240)
    const rotated = img.at(110, 110)
    const unrotated = img.at(40, 150)
    expect(rotated[0]).toBeLessThan(40)
    expect(unrotated[0]).toBeGreaterThan(240)
  })

  it('hello 的标签画在中部，不贴在左上角', async () => {
    const source = await readFile(join(pkgDir, 'examples/hello.fvg'), 'utf8')
    const { png } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    const img = await pixelsFromPng(png)
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
    const img = await pixelsFromPng(png)
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
    const img = await pixelsFromPng(png)
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

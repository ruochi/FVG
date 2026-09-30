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

  it('内阴影压暗圆角矩形内侧', async () => {
    const { png, report } = await renderFvg(
      `<fvg width="120" height="80" background="#ffffff"><Rect cx="60" cy="40" width="80" height="50" rx="8" fill="#6aa1ff" inner-shadow="0 6 8 #000000aa" /></fvg>`,
    )
    const plain = await renderFvg(
      `<fvg width="120" height="80" background="#ffffff"><Rect cx="60" cy="40" width="80" height="50" rx="8" fill="#6aa1ff" /></fvg>`,
    )
    const { at } = await pixels(png)
    const base = await pixels(plain.png)
    const bottomInner = at(60, 58)
    const plainBottom = base.at(60, 58)
    expect(bottomInner[0] + bottomInner[1] + bottomInner[2]).toBeLessThan(
      plainBottom[0] + plainBottom[1] + plainBottom[2] - 20,
    )
    expect(report.elements.some((el) => el.innerShadow?.y === 6)).toBe(true)
  })

  it('图层模糊把硬边染开', async () => {
    const sharp = await renderFvg(
      `<fvg width="80" height="80" background="#000000"><Rect cx="40" cy="40" width="20" height="20" fill="#ffffff" /></fvg>`,
    )
    const soft = await renderFvg(
      `<fvg width="80" height="80" background="#000000"><Rect cx="40" cy="40" width="20" height="20" fill="#ffffff" blur="6" /></fvg>`,
    )
    const a = await pixels(sharp.png)
    const b = await pixels(soft.png)
    expect(a.at(40, 22)[0]).toBeLessThan(10)
    expect(b.at(40, 22)[0]).toBeGreaterThan(20)
    expect(soft.report.elements.some((el) => el.blur === 6)).toBe(true)
  })

  it('backdrop-blur 糊掉半透明块背后的条纹', async () => {
    const scene = (backdrop: string) =>
      `<fvg width="120" height="80" background="#102038">
        <Rect x="0" y="0" width="120" height="80" fill="#204060" />
        <Rect x="0" y="30" width="120" height="8" fill="#f4efe4" />
        <Rect cx="60" cy="40" width="70" height="40" rx="8" fill="#ffffff55" ${backdrop} />
      </fvg>`
    const withBlur = await renderFvg(scene('backdrop-blur="8"'))
    const without = await renderFvg(scene(''))
    const a = await pixels(withBlur.png)
    const b = await pixels(without.png)
    // 条纹上方：有 backdrop 时奶油色会渗上来
    expect(a.at(60, 26)[0]).toBeGreaterThan(b.at(60, 26)[0] + 15)
    expect(withBlur.report.elements.some((el) => el.backdropBlur === 8)).toBe(true)
  })
  it('filter grayscale 去掉饱和色', async () => {
    const color = await renderFvg(
      `<fvg width="40" height="40" background="#000000"><Rect cx="20" cy="20" width="30" height="30" fill="#ff0000" /></fvg>`,
    )
    const gray = await renderFvg(
      `<fvg width="40" height="40" background="#000000"><Rect cx="20" cy="20" width="30" height="30" fill="#ff0000" filter="grayscale(1)" /></fvg>`,
    )
    const c = await pixels(color.png)
    const g = await pixels(gray.png)
    expect(c.at(20, 20)[0]).toBeGreaterThan(c.at(20, 20)[1] + 50)
    expect(Math.abs(g.at(20, 20)[0] - g.at(20, 20)[1])).toBeLessThan(8)
  })

  it('noise 与 blend 进入报告', async () => {
    const { report } = await renderFvg(
      `<fvg width="60" height="60" background="#112233"><Rect cx="30" cy="30" width="40" height="40" fill="#3ecfc4" noise="0.2" blend="multiply" inner-glow="10 #ffffff" /></fvg>`,
    )
    const el = report.elements.find((e) => e.tag === 'Rect')
    expect(el?.noise).toEqual({ amount: 0.2 })
    expect(el?.blend).toBe('multiply')
    expect(el?.innerGlow?.blur).toBe(10)
  })
})

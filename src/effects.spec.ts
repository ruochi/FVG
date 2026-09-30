import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { renderFlexLayer } from './render.js'

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: join(homedir(), '.cache', 'flexlayer', 'fonts') })
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
    const { png } = await renderFlexLayer(
      `<Layer width="200" height="200" background="#ffffff"><Path d="M 80 90 L 140 90" stroke="#0000ff" stroke-width="4" /></Layer>`,
    )
    const { at } = await pixels(png)
    const onLine = at(100, 90)
    const doubled = at(160, 180)
    expect(onLine[2]).toBeGreaterThan(200)
    expect(doubled[0]).toBeGreaterThan(240)
    expect(doubled[2]).toBeGreaterThan(240)
  })

  it('夜空渐变上深下浅，月晕染到圆的外面', async () => {
    const { png } = await renderFlexLayer(
      `<Layer width="120" height="120" background="#ffffff"><Rect x="0" y="0" width="120" height="120" fill="linear-gradient(#102038, #d8e2ea)" /><Circle cx="60" cy="60" r="16" fill="#f4efe4" glow="18 #f4efe4" /></Layer>`,
    )
    const { at } = await pixels(png)
    expect(at(10, 8)[2]).toBeGreaterThan(at(10, 8)[0])
    expect(at(10, 110)[0]).toBeGreaterThan(at(10, 8)[0])
    const halo = at(60, 36)
    const sky = at(8, 36)
    expect(halo[0]).toBeGreaterThan(sky[0] + 20)
  })

  it('同一 symbol 可以摆两次', async () => {
    const { png } = await renderFlexLayer(
      `<Layer width="80" height="40" background="#ffffff"><symbol id="dot"><Circle cx="8" cy="8" r="6" fill="#ff0000" /></symbol><use href="#dot" cx="16" cy="20" /><use href="#dot" cx="56" cy="20" /></Layer>`,
    )
    const { at } = await pixels(png)
    expect(at(16, 20)[0]).toBeGreaterThan(200)
    expect(at(56, 20)[0]).toBeGreaterThan(200)
    expect(at(36, 20)[0]).toBeGreaterThan(240)
  })

  it('内阴影压暗圆角矩形内侧', async () => {
    const { png, report } = await renderFlexLayer(
      `<Layer width="120" height="80" background="#ffffff"><Rect cx="60" cy="40" width="80" height="50" rx="8" fill="#6aa1ff" inner-shadow="0 6 8 #000000aa" /></Layer>`,
    )
    const plain = await renderFlexLayer(
      `<Layer width="120" height="80" background="#ffffff"><Rect cx="60" cy="40" width="80" height="50" rx="8" fill="#6aa1ff" /></Layer>`,
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
    const sharp = await renderFlexLayer(
      `<Layer width="80" height="80" background="#000000"><Rect cx="40" cy="40" width="20" height="20" fill="#ffffff" /></Layer>`,
    )
    const soft = await renderFlexLayer(
      `<Layer width="80" height="80" background="#000000"><Rect cx="40" cy="40" width="20" height="20" fill="#ffffff" blur="6" /></Layer>`,
    )
    const a = await pixels(sharp.png)
    const b = await pixels(soft.png)
    expect(a.at(40, 22)[0]).toBeLessThan(10)
    expect(b.at(40, 22)[0]).toBeGreaterThan(20)
    expect(soft.report.elements.some((el) => el.blur === 6)).toBe(true)
  })

  it('backdrop-blur 糊掉半透明块背后的条纹', async () => {
    const scene = (backdrop: string) =>
      `<Layer width="120" height="80" background="#102038">
        <Rect x="0" y="0" width="120" height="80" fill="#204060" />
        <Rect x="0" y="30" width="120" height="8" fill="#f4efe4" />
        <Rect cx="60" cy="40" width="70" height="40" rx="8" fill="#ffffff55" ${backdrop} />
      </Layer>`
    const withBlur = await renderFlexLayer(scene('backdrop-blur="8"'))
    const without = await renderFlexLayer(scene(''))
    const a = await pixels(withBlur.png)
    const b = await pixels(without.png)
    // 条纹上方：有 backdrop 时奶油色会渗上来
    expect(a.at(60, 26)[0]).toBeGreaterThan(b.at(60, 26)[0] + 15)
    expect(withBlur.report.elements.some((el) => el.backdropBlur === 8)).toBe(true)
  })
  it('filter grayscale 去掉饱和色', async () => {
    const color = await renderFlexLayer(
      `<Layer width="40" height="40" background="#000000"><Rect cx="20" cy="20" width="30" height="30" fill="#ff0000" /></Layer>`,
    )
    const gray = await renderFlexLayer(
      `<Layer width="40" height="40" background="#000000"><Rect cx="20" cy="20" width="30" height="30" fill="#ff0000" filter="grayscale(1)" /></Layer>`,
    )
    const c = await pixels(color.png)
    const g = await pixels(gray.png)
    expect(c.at(20, 20)[0]).toBeGreaterThan(c.at(20, 20)[1] + 50)
    expect(Math.abs(g.at(20, 20)[0] - g.at(20, 20)[1])).toBeLessThan(8)
  })

  it('noise 与 blend 进入报告', async () => {
    const { report } = await renderFlexLayer(
      `<Layer width="60" height="60" background="#112233"><Rect cx="30" cy="30" width="40" height="40" fill="#3ecfc4" noise="0.2" blend="multiply" inner-glow="10 #ffffff" /></Layer>`,
    )
    const el = report.elements.find((e) => e.tag === 'Rect')
    expect(el?.noise).toEqual({ amount: 0.2 })
    expect(el?.blend).toBe('multiply')
    expect(el?.innerGlow?.blur).toBe(10)
  })

  it('clear glass 不模糊：中心原样透出，边缘弧面把内侧内容折射出来', async () => {
    // 左红右青，分界 x=165；圆心 (100,100) r=80 → 右缘弧面里的青色像素被向内折射成红色
    const scene = (glass: string) =>
      `<Layer width="240" height="200" background="#000000">
        <Rect x="0" y="0" width="165" height="200" fill="#ff0000" />
        <Rect x="165" y="0" width="75" height="200" fill="#00e5ff" />
        <Circle cx="100" cy="100" r="80" fill="#ffffff00" ${glass} />
      </Layer>`
    const withGlass = await renderFlexLayer(scene('glass="clear"'))
    const plain = await renderFlexLayer(scene(''))
    const g = await pixels(withGlass.png)
    const p = await pixels(plain.png)
    expect(g.at(100, 100)).toEqual(p.at(100, 100))
    expect(p.at(172, 100)[0]).toBeLessThan(15)
    expect(g.at(172, 100)[0]).toBeGreaterThan(150)
    // 折射后的红青分界仍然锐利：过渡不超过 3px
    let soft = 0
    for (let x = 100; x < 178; x++) {
      const r = g.at(x, 100)[0]
      if (r > 30 && r < 225) soft++
    }
    expect(soft).toBeLessThanOrEqual(3)
    expect(withGlass.report.elements.some((el) => el.glass?.variant === 'clear' && el.glass.blur === 0)).toBe(true)
  })

  it('文字投影跟随字形墨迹，不是整块盒子', async () => {
    // 「一」只有中间横笔；红影右移 20px。盒子上沿内侧若出现红斑，说明仍按 box 投影。
    const { png, report } = await renderFlexLayer(
      `<Layer width="200" height="100" background="#ffffff" color="#0000ff">
        <Layer cx="100" cy="50">
          <h1 style="font-size:64px; color:#0000ff; shadow:20 0 0 #ff0000">一</h1>
        </Layer>
      </Layer>`,
    )
    const { at } = await pixels(png)
    const h1 = report.elements.find((el) => el.tag === 'h1')!
    const aboveStrokeX = Math.round(h1.box.left + h1.box.width / 2 + 20)
    const aboveStrokeY = Math.round(h1.box.top + 6)
    const above = at(aboveStrokeX, aboveStrokeY)
    // 横笔上方应仍是白底（字形投影），不能是盒子投下的红块
    expect(above[0]).toBeGreaterThan(240)
    expect(above[1]).toBeGreaterThan(240)
    expect(above[2]).toBeGreaterThan(240)
    // 墨迹右侧应能采到红色投影
    let red = 0
    for (let y = Math.floor(h1.ink.top); y < Math.ceil(h1.ink.bottom); y++) {
      for (let x = Math.floor(h1.ink.right); x < Math.min(200, Math.ceil(h1.ink.right + 28)); x++) {
        const p = at(x, y)
        if (p[0]! > 200 && p[1]! < 80 && p[2]! < 80) red++
      }
    }
    expect(red).toBeGreaterThan(20)
  })
})

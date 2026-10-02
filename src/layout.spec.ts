import { existsSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { GlobalFonts } from '@napi-rs/canvas'
import { getFontsCacheDir, initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'

const FONT_DIRS = [join(homedir(), '.cache', 'flexlayer', 'fonts'), '/tmp/flexlayer-test']

beforeAll(async () => {
  for (const dir of FONT_DIRS) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('layoutSource', () => {
  it('Layer anchor top-left', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="300" background="#fff"><Layer cx="10" cy="10" anchor="top-left"><h1>A</h1></Layer></Layer>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.x).toBe(10)
    expect(layer?.y).toBe(10)
  })

  it('线条边界盒', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="200"><Line x1="10" y1="10" x2="100" y2="50" /></Layer>`,
      process.cwd(),
    )
    const line = doc.root.children[0]
    expect(line?.kind).toBe('line')
    expect(line!.width).toBeGreaterThan(0)
  })

  it('线条使用 Layer 的局部坐标，不被重新居中', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="400"><Layer cx="200" cy="200" width="300" height="300"><Line x1="10" y1="10" x2="50" y2="10" stroke-width="4" /><Polygon points="100,100 140,100 100,160" stroke-width="2" /></Layer></Layer>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.kind).toBe('layer')
    const [line, polygon] = (layer as { children: Array<{ x: number; y: number; width: number; height: number; ink: { y: number; height: number } }> }).children
    // 盒子是纯几何范围，描边只进 ink
    expect(line?.x).toBe(10)
    expect(line?.y).toBe(10)
    expect(line?.width).toBe(40)
    expect(line?.height).toBe(0)
    expect(line?.ink.y).toBe(-2)
    expect(line?.ink.height).toBe(4)
    expect(polygon?.x).toBe(100)
    expect(polygon?.y).toBe(100)
  })

  it('Rect 两点写法可以反着写，和尺寸写法同时出现时报错', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="400"><Rect x1="80" y1="60" x2="20" y2="10" fill="#fff" /><Rect x1="0" y1="0" x2="40" y2="20" width="10" height="10" /></Layer>`,
      process.cwd(),
    )
    const [reversed, mixed] = doc.root.children as Array<{ x: number; y: number; width: number; height: number }>
    expect(reversed).toMatchObject({ x: 20, y: 10, width: 60, height: 50 })
    expect(mixed).toMatchObject({ x: 0, y: 0, width: 40, height: 20 })
    expect(doc.issues.some((issue) => issue.code === 'invalid-attr' && issue.hint)).toBe(true)
  })

  it('竖排 flex 把文字排成一列', async () => {
    const doc = await layoutSource(
      `<Layer width="800" height="400"><div style="display:flex; flex-direction:column; gap:20px"><p style="font-size:40px">甲</p><p style="font-size:40px">乙</p></div></Layer>`,
      process.cwd(),
    )
    const column = doc.root.children[0] as { children: Array<{ y: number }> }
    expect(column.children[1]!.y).toBeGreaterThan(column.children[0]!.y)
  })

  it('flex 里带内边距的短文字不被小数宽度挤到换行', async () => {
    const doc = await layoutSource(
      `<Layer width="1920" height="1080"><div style="display:flex; gap:20px"><div style="padding:2px 29px; font-size:72px">a²</div><div style="padding:4px 22px; border:2px solid #333; font-size:44px">1 三角形</div></div></Layer>`,
      process.cwd(),
    )
    expect(doc.issues.filter((i) => i.code === 'auto-wrap')).toEqual([])
    const row = doc.root.children[0] as { children: Array<{ textLayout: { lines: unknown[] } }> }
    for (const child of row.children) expect(child.textLayout.lines).toHaveLength(1)
  })

  it('没写宽高的 Layer 原点固定，负坐标不会平移其他子元素', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="400"><Layer><Rect cx="10" cy="10" anchor="top-left" width="20" height="20" /><Rect cx="-40" cy="30" anchor="top-left" width="20" height="20" /></Layer></Layer>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.kind).toBe('layer')
    const [first, second] = (layer as { children: Array<{ x: number; y: number }> }).children
    expect(first?.x).toBe(10)
    expect(first?.y).toBe(10)
    expect(second?.x).toBe(-40)
    expect(second?.y).toBe(30)
  })

  it('Path 几何减去盒子原点，和折线同一套局部坐标', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="200"><Path d="M 80 90 L 140 90" /><Path d="M 80 90 l 40 0" /></Layer>`,
      process.cwd(),
    )
    const [absolute, relative] = doc.root.children as Array<{ x: number; y: number; geometry: { kind: string; d: string } }>
    expect(absolute.x).toBe(80)
    expect(absolute.y).toBe(90)
    expect(absolute.geometry.d).toBe('M 0 0 L 60 0')
    expect(relative.geometry.d).toBe('M 0 0 l 40 0')
  })

  it('Curve 穿过点，开口不填充', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="300"><Curve points="30,100 100,40 170,100" fill="#ff0000" /><Curve points="40,40 160,40 100,140" closed fill="#00ff00" /></Layer>`,
      process.cwd(),
    )
    const [open, closed] = doc.root.children as Array<{ tag: string; fill: string; geometry: { kind: string; d: string } }>
    expect(open.tag).toBe('Curve')
    expect(open.fill).toBe('none')
    expect(open.geometry.kind).toBe('path')
    expect(open.geometry.d).toContain(' C ')
    expect(closed.fill).toBe('#00ff00')
    expect(closed.geometry.d.endsWith('Z')).toBe(true)
    expect(doc.issues.some((issue) => issue.code === 'open-curve-fill')).toBe(true)
  })

  it('symbol 不占位，use 按 cx cy 各放一份', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="120"><symbol id="dot" width="20" height="20"><Circle cx="10" cy="10" r="8" fill="#ff0000" /></symbol><use href="#dot" cx="40" cy="30" /><use href="#dot" cx="80" cy="30" /></Layer>`,
      process.cwd(),
    )
    expect(doc.root.children.map((child) => child.tag)).toEqual(['use', 'use'])
    expect(doc.root.children.map((child) => child.x)).toEqual([30, 70])
    expect(doc.issues.filter((issue) => issue.code === 'missing-symbol')).toEqual([])
  })

  it('竖排寒露高过宽，字从上到下', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="400"><h1 style="writing-mode:vertical-rl; font-size:40px; letter-spacing:8px">寒露</h1></Layer>`,
      process.cwd(),
    )
    const title = doc.root.children[0] as {
      width: number
      height: number
      textLayout: { lines: Array<{ segments: Array<{ text: string }>; baselineY: number }> }
    }
    expect(title.height).toBeGreaterThan(title.width)
    expect(title.textLayout.lines.map((line) => line.segments[0]?.text)).toEqual(['寒', '露'])
    expect(title.textLayout.lines[1]!.baselineY).toBeGreaterThan(title.textLayout.lines[0]!.baselineY)
  })

  it('渐变、阴影和光晕写进图形', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="200"><Circle cx="40" cy="40" r="20" fill="radial-gradient(#fff, #fff0)" glow="12 #fff" shadow="0 4 8 #00000055" /></Layer>`,
      process.cwd(),
    )
    const circle = doc.root.children[0] as { fill: string; glow?: { blur: number; color: string }; shadow?: { y: number; blur: number } }
    expect(circle.fill).toBe('radial-gradient(#fff, #fff0)')
    expect(circle.glow).toMatchObject({ blur: 12, color: '#fff' })
    expect(circle.shadow).toMatchObject({ y: 4, blur: 8 })
  })

  it('新效果属性写进布局节点', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="200"><Rect cx="40" cy="40" width="40" height="40" fill="#fff" inner-shadow="0 2 4 #00000055" blur="3" backdrop-blur="5" noise="0.1 #fff" filter="brightness(1.1)" blend="screen" /></Layer>`,
      process.cwd(),
    )
    const rect = doc.root.children[0] as {
      innerShadow?: { y: number }
      blur?: number
      backdropBlur?: number
      noise?: { amount: number }
      colorFilter?: Array<{ name: string }>
      blend?: string
    }
    expect(rect.innerShadow).toMatchObject({ y: 2 })
    expect(rect.blur).toBe(3)
    expect(rect.backdropBlur).toBe(5)
    expect(rect.noise).toMatchObject({ amount: 0.1 })
    expect(rect.colorFilter?.[0]?.name).toBe('brightness')
    expect(rect.blend).toBe('screen')
  })

  it('align-items 的 flex-start 和 flex-end 按起止对齐', async () => {
    const place = async (align: string) => {
      const doc = await layoutSource(
        `<Layer width="400" height="200"><div style="display:flex; flex-direction:column; width:300px; align-items:${align}"><p style="font-size:40px">甲</p><p style="font-size:40px">甲乙丙丁</p></div></Layer>`,
        process.cwd(),
      )
      const column = doc.root.children[0] as { width: number; children: Array<{ x: number; width: number }> }
      return column
    }
    const atStart = await place('flex-start')
    expect(atStart.children.map((child) => child.x)).toEqual([0, 0])
    const atEnd = await place('flex-end')
    for (const child of atEnd.children) expect(child.x + child.width).toBeCloseTo(atEnd.width, 0)
    expect(atEnd.children[0]!.x).toBeGreaterThan(0)
    const named = await place('end')
    expect(named.children.map((child) => Math.round(child.x))).toEqual(atEnd.children.map((child) => Math.round(child.x)))
  })

  it('没写宽度的竖排 flex 居中后仍落在定位点上', async () => {
    const doc = await layoutSource(
      `<Layer width="800" height="400"><Layer cx="400" cy="120"><div style="display:flex; flex-direction:column; align-items:center; gap:8px"><p style="font-size:40px">甲</p><p style="font-size:40px">甲乙丙丁</p></div></Layer></Layer>`,
      process.cwd(),
    )
    const layer = doc.root.children[0] as { x: number; children: Array<{ x: number; children: Array<{ x: number; width: number }> }> }
    const column = layer.children[0]!
    for (const child of column.children) {
      expect(layer.x + column.x + child.x + child.width / 2).toBeCloseTo(400, 0)
    }
    const hello = await layoutSource(readFileSync(join(process.cwd(), 'examples/hello.layer'), 'utf8'), process.cwd())
    const card = hello.root.children[0] as { x: number; children: Array<{ x: number; children: Array<{ x: number; width: number }> }> }
    const title = card.children[0]!.children[0]!
    expect(card.x + card.children[0]!.x + title.x + title.width / 2).toBeCloseTo(540, 0)
  })

  it('justify-content 的 flex-end 靠右', async () => {
    const doc = await layoutSource(
      `<Layer width="400" height="120"><div style="display:flex; width:300px; justify-content:flex-end"><p style="font-size:40px">甲</p></div></Layer>`,
      process.cwd(),
    )
    const row = doc.root.children[0] as { width: number; children: Array<{ x: number; width: number }> }
    const text = row.children[0]!
    expect(text.x + text.width).toBeCloseTo(row.width, 0)
    expect(text.x).toBeGreaterThan(0)
  })

  it('根 Layer 里的 font 会注册', async () => {
    const src = join(getFontsCacheDir(), 'ChillDuanSansVF.ttf')
    const inside = 'ProbeFontInside'
    const before = 'ProbeFontBefore'
    const nested = 'ProbeFontNested'
    const insideDoc = await layoutSource(
      `<Layer width="200" height="80"><font family="${inside}" src="${src}" /><p style="font-family:${inside}; font-size:32px">字</p></Layer>`,
      process.cwd(),
    )
    expect(GlobalFonts.has(inside)).toBe(true)
    expect(insideDoc.issues.filter((issue) => issue.code === 'unknown-tag')).toEqual([])
    await layoutSource(
      `<font family="${before}" src="${src}" /><Layer width="200" height="80"><p style="font-size:32px">字</p></Layer>`,
      process.cwd(),
    )
    expect(GlobalFonts.has(before)).toBe(true)
    const nestedDoc = await layoutSource(
      `<Layer width="200" height="80"><Layer><font family="${nested}" src="${src}" /></Layer></Layer>`,
      process.cwd(),
    )
    expect(GlobalFonts.has(nested)).toBe(false)
    expect(nestedDoc.issues.some((issue) => issue.code === 'invalid-child' && issue.message.includes('<font>'))).toBe(true)
  })

  it('根 Layer 里的 font 会改变字宽', async () => {
    const src = ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', '/usr/share/fonts/truetype/croscore/Cousine-Regular.ttf'].find(
      (path) => existsSync(path),
    )
    if (!src) return
    const family = 'Probe Mono'
    const sample = '0123456789'
    const textWidth = (source: string) =>
      layoutSource(source, process.cwd()).then((doc) => {
        const node = doc.root.children.find((child) => child.kind === 'text')
        return { width: node && node.kind === 'text' ? node.width : 0, issues: doc.issues }
      })
    const inside = await textWidth(
      `<Layer width="1080" height="80"><font family="${family}" src="${src}" /><p style="font-family:${family}; font-size:32px">${sample}</p></Layer>`,
    )
    const outside = await textWidth(
      `<font family="${family}" src="${src}" /><Layer width="1080" height="80"><p style="font-family:${family}; font-size:32px">${sample}</p></Layer>`,
    )
    const plain = await textWidth(`<Layer width="1080" height="80"><p style="font-size:32px">${sample}</p></Layer>`)
    expect(inside.issues.filter((issue) => issue.code === 'unknown-tag' || issue.code === 'invalid-child')).toEqual([])
    expect(inside.width).toBeCloseTo(outside.width, 1)
    expect(Math.abs(inside.width - plain.width)).toBeGreaterThan(1)
  })

  it('invalid-child 线条进 flex', async () => {
    const doc = await layoutSource(
      `<Layer width="200" height="200"><div style="display:flex"><Line x1="0" y1="0" x2="10" y2="10" /></div></Layer>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

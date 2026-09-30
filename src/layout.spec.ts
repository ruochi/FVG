import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'

const FONT_DIRS = [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']

beforeAll(async () => {
  for (const dir of FONT_DIRS) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('layoutSource', () => {
  it('Layer anchor top-left', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300" background="#fff"><Layer cx="10" cy="10" anchor="top-left"><h1>A</h1></Layer></fvg>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.x).toBe(10)
    expect(layer?.y).toBe(10)
  })

  it('线条边界盒', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Line x1="10" y1="10" x2="100" y2="50" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]
    expect(line?.kind).toBe('line')
    expect(line!.width).toBeGreaterThan(0)
  })

  it('线条使用 Layer 的局部坐标，不被重新居中', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="400"><Layer cx="200" cy="200" width="300" height="300"><Line x1="10" y1="10" x2="50" y2="10" stroke-width="4" /><Polygon points="100,100 140,100 100,160" stroke-width="2" /></Layer></fvg>`,
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
      `<fvg width="400" height="400"><Rect x1="80" y1="60" x2="20" y2="10" fill="#fff" /><Rect x1="0" y1="0" x2="40" y2="20" width="10" height="10" /></fvg>`,
      process.cwd(),
    )
    const [reversed, mixed] = doc.root.children as Array<{ x: number; y: number; width: number; height: number }>
    expect(reversed).toMatchObject({ x: 20, y: 10, width: 60, height: 50 })
    expect(mixed).toMatchObject({ x: 0, y: 0, width: 40, height: 20 })
    expect(doc.issues.some((issue) => issue.code === 'invalid-attr' && issue.hint)).toBe(true)
  })

  it('竖排 flex 把文字排成一列', async () => {
    const doc = await layoutSource(
      `<fvg width="800" height="400"><div style="display:flex; flex-direction:column; gap:20px"><p style="font-size:40px">甲</p><p style="font-size:40px">乙</p></div></fvg>`,
      process.cwd(),
    )
    const column = doc.root.children[0] as { children: Array<{ y: number }> }
    expect(column.children[1]!.y).toBeGreaterThan(column.children[0]!.y)
  })

  it('flex 里带内边距的短文字不被小数宽度挤到换行', async () => {
    const doc = await layoutSource(
      `<fvg width="1920" height="1080"><div style="display:flex; gap:20px"><div style="padding:2px 29px; font-size:72px">a²</div><div style="padding:4px 22px; border:2px solid #333; font-size:44px">1 三角形</div></div></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.filter((i) => i.code === 'auto-wrap')).toEqual([])
    const row = doc.root.children[0] as { children: Array<{ textLayout: { lines: unknown[] } }> }
    for (const child of row.children) expect(child.textLayout.lines).toHaveLength(1)
  })

  it('没写宽高的 Layer 原点固定，负坐标不会平移其他子元素', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="400"><Layer><Rect cx="10" cy="10" anchor="top-left" width="20" height="20" /><Rect cx="-40" cy="30" anchor="top-left" width="20" height="20" /></Layer></fvg>`,
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

  it('invalid-child 线条进 flex', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><div style="display:flex"><Line x1="0" y1="0" x2="10" y2="10" /></div></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

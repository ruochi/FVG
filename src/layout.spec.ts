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
      `<fvg width="400" height="300" background="#fff"><h1 cx="10" cy="10" anchor="top-left">A</h1></fvg>`,
      process.cwd(),
    )
    const h1 = doc.root.children[0]
    expect(h1?.x).toBe(10)
    expect(h1?.y).toBe(10)
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
    const [line, polygon] = (layer as { children: Array<{ x: number; y: number }> }).children
    // 盒子 = 几何范围 + 半个描边 + 4px 余量
    expect(line?.x).toBe(4)
    expect(line?.y).toBe(4)
    expect(polygon?.x).toBe(95)
    expect(polygon?.y).toBe(95)
  })

  it('Row 里带内边距的短文字不被小数宽度挤到换行', async () => {
    const doc = await layoutSource(
      `<fvg width="1920" height="1080"><Row style="gap:20px"><div style="padding:2px 29px; font-size:72px">a²</div><div style="padding:4px 22px; border:2px solid #333; font-size:44px">1 三角形</div></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.filter((i) => i.code === 'auto-wrap')).toEqual([])
    const row = doc.root.children[0] as { children: Array<{ textLayout: { lines: unknown[] } }> }
    for (const child of row.children) expect(child.textLayout.lines).toHaveLength(1)
  })

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

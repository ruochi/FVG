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

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })

  it('自动尺寸的 Column 包住矩形', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Column><Rect width="40" height="20" /></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    expect(col?.kind).toBe('flex')
    expect(col!.width).toBeCloseTo(40, 3)
    expect(col!.height).toBeCloseTo(20, 3)
    if (col?.kind !== 'flex') return
    expect(col.children[0]!.x).toBeCloseTo(0, 3)
    expect(col.children[0]!.y).toBeCloseTo(0, 3)
  })

  it('自动高度的 Column 在 justify center 时仍包住内容', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Column style="justify-content:center"><Rect width="40" height="20" /></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    expect(col!.height).toBeCloseTo(20, 3)
    if (col?.kind !== 'flex') return
    expect(col.children[0]!.y).toBeCloseTo(0, 3)
  })

  it('自动宽度的 Row 在 space-between 时不撑满画布', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Row style="justify-content:space-between"><Rect width="40" height="20" /><Rect width="40" height="20" /></Row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    expect(row!.width).toBeCloseTo(80, 3)
    if (row?.kind !== 'flex') return
    expect(row.children[1]!.x).toBeCloseTo(40, 3)
  })

  it('嵌套 Column 按父 Row 的宽度排，矩形留在列内', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Row style="width:100px"><Column><Rect width="80" height="10" /><Rect width="30" height="10" /></Column></Row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    if (row?.kind !== 'flex') return
    const col = row.children[0]
    expect(col?.kind).toBe('flex')
    expect(col!.width).toBeCloseTo(80, 3)
    expect(col!.x).toBeGreaterThanOrEqual(-0.5)
    expect(col!.x + col!.width).toBeLessThanOrEqual(row.width + 0.5)
    if (col?.kind !== 'flex') return
    for (const rect of col.children) {
      expect(rect.x).toBeGreaterThanOrEqual(-0.5)
      expect(rect.x + rect.width).toBeLessThanOrEqual(col.width + 0.5)
    }
  })

  it('Column 定宽后文字按列宽换行，且 auto-wrap 只记一次', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="400"><Column style="width:120px"><p>一二三四五六七八九十甲乙丙丁</p></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    expect(col?.kind).toBe('flex')
    if (col?.kind !== 'flex') return
    const text = col.children[0]
    expect(text?.kind).toBe('text')
    expect(text!.width).toBeLessThanOrEqual(120.5)
    expect(text!.x).toBeGreaterThanOrEqual(-0.5)
    expect(text!.x + text!.width).toBeLessThanOrEqual(col.width + 0.5)
    expect(col.height).toBeGreaterThan(48)
    expect(doc.issues.filter((i) => i.code === 'auto-wrap')).toHaveLength(1)
  })

  it('flex-grow 的文字盒子占满行内剩余宽度', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="200"><Row style="width:300px"><p style="flex-grow:1">Hi</p><Rect width="40" height="20" /></Row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    if (row?.kind !== 'flex') return
    expect(row.width).toBeCloseTo(300, 3)
    expect(row.children[0]!.width).toBeCloseTo(260, 1)
    expect(row.children[1]!.x).toBeCloseTo(260, 1)
  })

  it('padding 后子节点从内边距处开始', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="200"><Row style="padding:24px"><Rect width="40" height="20" /></Row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    expect(row!.width).toBeCloseTo(88, 3)
    expect(row!.height).toBeCloseTo(68, 3)
    if (row?.kind !== 'flex') return
    expect(row.children[0]!.x).toBeCloseTo(24, 3)
    expect(row.children[0]!.y).toBeCloseTo(24, 3)
  })

  it('align-self 覆盖父级 align-items', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row style="height:80px; align-items:start"><Rect width="20" height="20" style="align-self:end" /></Row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    if (row?.kind !== 'flex') return
    expect(row.children[0]!.y).toBeCloseTo(60, 3)
  })

  it('有宽度的 Layer 把内部 Row/Column 的上限收成这一层的宽度', async () => {
    const doc = await layoutSource(
      `<fvg width="800" height="400"><Layer width="100" height="200"><Column><p>一二三四五六七八九十甲乙丙丁</p></Column></Layer></fvg>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.kind).toBe('layer')
    if (layer?.kind !== 'layer') return
    const col = layer.children[0]
    expect(col?.kind).toBe('flex')
    expect(col!.width).toBeLessThanOrEqual(100.5)
    if (col?.kind !== 'flex') return
    expect(col.children[0]!.width).toBeLessThanOrEqual(100.5)
  })

  it('非法线条被跳过后，后面的矩形仍然排上', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /><Rect width="40" height="20" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    if (row?.kind !== 'flex') return
    expect(row.children).toHaveLength(1)
    expect(row.children[0]!.width).toBeCloseTo(40, 3)
    expect(row.children[0]!.x).toBeCloseTo(0, 3)
    expect(row.width).toBeCloseTo(40, 3)
  })
})

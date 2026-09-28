import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'
import { buildReport } from './report.js'

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

  it('transform-origin 用像素，拒绝百分比和 em', async () => {
    const px = await layoutSource(
      `<fvg width="200" height="200"><Rect width="40" height="20" transform-origin="8 3" /></fvg>`,
      process.cwd(),
    )
    expect(px.root.children[0]?.origin).toEqual({ x: 8, y: 3 })

    const styled = await layoutSource(
      `<fvg width="200" height="200"><Rect width="40" height="20" transform-origin="top" style="transform-origin: 4px 6px" /></fvg>`,
      process.cwd(),
    )
    expect(styled.root.children[0]?.origin).toEqual({ x: 4, y: 6 })

    const bad = await layoutSource(
      `<fvg width="200" height="200"><Rect width="80" height="10" transform-origin="50%" /><Rect width="10" height="10" transform-origin="1em 2em" /></fvg>`,
      process.cwd(),
    )
    expect(bad.issues.filter((i) => i.code === 'invalid-attr')).toHaveLength(2)
    expect(bad.root.children[0]?.origin).toEqual({ x: 'center', y: 'center' })
    expect(bad.root.children[1]?.origin).toEqual({ x: 'center', y: 'center' })
  })

  it('旋转后的着墨超出画布', async () => {
    const doc = await layoutSource(
      `<fvg width="100" height="100"><Rect width="80" height="10" cx="10" cy="30" anchor="top-left" rotate="90" transform-origin="top-left" /></fvg>`,
      process.cwd(),
    )
    const rep = buildReport(doc)
    expect(rep.issues.some((i) => i.code === 'overflow-canvas' && i.path.endsWith('Rect[0]'))).toBe(true)
    const rect = rep.elements.find((e) => e.tag === 'Rect')
    expect(rect?.box.x).toBe(10)
    expect(rect?.box.y).toBe(30)
    expect(rect!.ink.bottom).toBeGreaterThan(100)
  })

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

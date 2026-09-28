import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { checkFvg } from './render.js'
import { buildReport } from './report.js'
import type { FvgDocument, LayerLayoutNode, TextLayoutNode } from './types.js'

function minimalDoc(overrides: Partial<FvgDocument> = {}): FvgDocument {
  const text: TextLayoutNode = {
    kind: 'text',
    path: 'fvg/h1[0]',
    tag: 'h1',
    x: -5,
    y: 0,
    width: 100,
    height: 40,
    ink: { x: 0, y: 0, width: 100, height: 40 },
    opacity: 1,
    rotate: 0,
    scale: 1,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    textAlign: 'left',
    textLayout: {
      lines: [],
      contentWidth: 100,
      contentHeight: 40,
      minWidth: 40,
      ink: { x: 0, y: 0, width: 100, height: 40 },
      fontSize: 88,
      autoWrap: false,
      overflowFixed: false,
    },
  }
  const root: LayerLayoutNode = {
    kind: 'layer',
    path: 'fvg',
    tag: 'layer',
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
    ink: text.ink,
    opacity: 1,
    rotate: 0,
    scale: 1,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    children: [text],
  }
  return {
    width: 1080,
    height: 1920,
    background: '#fff',
    color: '#111',
    fontFamily: 'ChillDuanSans',
    safe: { top: 40, right: 40, bottom: 40, left: 40 },
    root,
    issues: [],
    ...overrides,
  }
}

describe('buildReport', () => {
  it('overflow-canvas', () => {
    const rep = buildReport(minimalDoc())
    expect(rep.issues.some((i) => i.code === 'overflow-canvas')).toBe(true)
  })

  it('outside-safe', () => {
    const rep = buildReport(minimalDoc())
    expect(rep.issues.some((i) => i.code === 'outside-safe')).toBe(true)
  })
})

describe('效果范围', () => {
  const fontsCacheDir = join(homedir(), '.cache', 'fvg', 'fonts')

  beforeAll(async () => {
    for (const dir of [fontsCacheDir, '/tmp/fvgtest']) {
      if (await initFontsForMeasure({ fontsCacheDir: dir })) break
    }
  })

  it('effect 覆盖偏移后的阴影和外扩的光晕', async () => {
    const rep = await checkFvg(
      `<fvg style="width:400px; height:400px"><rect cx="200" cy="200" style="width:100px; height:100px; shadow:0 20px 10px 5px; glow:4px" /></fvg>`,
      { fontsCacheDir },
    )
    const rect = rep.elements.find((e) => e.tag === 'rect')!
    expect(rect.shadow).toEqual({ x: 0, y: 20, blur: 10, spread: 5, color: '#00000066' })
    expect(rect.glow).toEqual({ blur: 4, spread: 0, color: '#000000' })
    expect(rect.effect).toMatchObject({ left: 125, top: 142, right: 275, bottom: 295 })
    expect(rep.issues).toEqual([])
  })

  it('本体在画布内、效果出界时记 effect-clipped', async () => {
    const rep = await checkFvg(
      `<fvg style="width:400px; height:400px"><circle cx="30" cy="200" style="r:20px; fill:#fff; glow:12px" /></fvg>`,
      { fontsCacheDir },
    )
    expect(rep.issues.map((i) => i.code)).toEqual(['effect-clipped'])
  })

  it('本体出界时只记 overflow-canvas', async () => {
    const rep = await checkFvg(
      `<fvg style="width:400px; height:400px"><circle cx="10" cy="200" style="r:20px; fill:#fff; glow:12px" /></fvg>`,
      { fontsCacheDir },
    )
    const codes = rep.issues.filter((i) => i.path === 'fvg/circle[0]').map((i) => i.code)
    expect(codes).toEqual(['overflow-canvas'])
  })
})

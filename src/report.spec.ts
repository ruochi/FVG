import { describe, expect, it } from 'vitest'
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
    origin: { x: 'center', y: 'center' },
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
    tag: 'Layer',
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
    ink: text.ink,
    opacity: 1,
    rotate: 0,
    scale: 1,
    origin: { x: 'center', y: 'center' },
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

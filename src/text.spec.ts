import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutText } from './text.js'
import type { TextSegment } from './types.js'

const FONT_DIRS = [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']

let hasFont = false

beforeAll(async () => {
  for (const dir of FONT_DIRS) {
    hasFont = await initFontsForMeasure({ fontsCacheDir: dir })
    if (hasFont) break
  }
})

const baseStyle = {
  fontFamily: 'ChillDuanSans',
  fontSize: 40,
  fontWeight: 400,
  color: '#000',
  letterSpacing: 0,
}

describe('layoutText', () => {
  it('英文单词不拆开', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [{ text: 'Bitcoin halving', style: baseStyle }]
    const r = layoutText({ segments, maxWidth: 200, lineHeightRatio: 1.2, fontSize: 40, textWrap: 'wrap' })
    expect(r.lines.some((l) => l.segments.some((s) => s.text === 'Bitcoin'))).toBe(true)
  })

  it('br 硬换行', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [
      { text: '第一行', style: baseStyle },
      { text: '第二行', style: baseStyle, hardBreakBefore: true },
    ]
    const r = layoutText({ segments, maxWidth: 1000, lineHeightRatio: 1.2, fontSize: 40 })
    expect(r.lines.length).toBeGreaterThanOrEqual(2)
  })

  it('最窄宽度', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [{ text: '比特币', style: baseStyle }]
    const r = layoutText({ segments, maxWidth: 1000, lineHeightRatio: 1.2, fontSize: 40 })
    expect(r.minWidth).toBeGreaterThan(0)
  })

  it('单行盒子贴着字形，行高不留在字外', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [{ text: '霜降', style: baseStyle }]
    const r = layoutText({ segments, maxWidth: 1000, lineHeightRatio: 1.2, fontSize: 40 })
    expect(r.lines).toHaveLength(1)
    expect(r.ink.y).toBeCloseTo(0)
    expect(r.contentHeight).toBeCloseTo(r.ink.height)
    expect(r.contentHeight).toBeLessThan(40 * 1.2 - 1)
  })

  it('多行的行高只出现在行与行之间', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [
      { text: '第一行', style: baseStyle },
      { text: '第二行', style: baseStyle, hardBreakBefore: true },
    ]
    const r = layoutText({ segments, maxWidth: 1000, lineHeightRatio: 1.2, fontSize: 40 })
    expect(r.lines).toHaveLength(2)
    const [a, b] = r.lines
    expect(b!.baselineY - a!.baselineY).toBeCloseTo(48)
    expect(r.ink.y).toBeCloseTo(0)
    expect(r.contentHeight).toBeCloseTo(b!.ink.y + b!.ink.height)
  })
})

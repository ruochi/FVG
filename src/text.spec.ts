import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutText } from './text.js'
import type { TextSegment } from './types.js'

const FONT_DIRS = [join(homedir(), '.cache', 'flexlayer', 'fonts'), '/tmp/flexlayer-test']

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

  it('行内保留空格，行首行尾去掉', () => {
    if (!hasFont) return
    const oneLine = layoutText({
      segments: [{ text: 'a² + b² = c²', style: baseStyle }],
      nowrap: true,
      lineHeightRatio: 1.2,
      fontSize: 40,
    })
    expect(oneLine.lines).toHaveLength(1)
    expect(oneLine.lines[0]!.segments.map((s) => s.text).join('')).toBe('a² + b² = c²')

    const wrapped = layoutText({
      segments: [{ text: 'Bitcoin halving', style: baseStyle }],
      maxWidth: 200,
      lineHeightRatio: 1.2,
      fontSize: 40,
      textWrap: 'wrap',
    })
    for (const line of wrapped.lines) {
      const text = line.segments.map((s) => s.text).join('')
      expect(text).toBe(text.trim())
    }
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
})

import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { extractTextSegments, layoutText } from './text.js'
import { parseFvg } from './parse.js'
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
    expect(r.lines.some((l) => l.segments.some((s) => s.text.startsWith('Bitcoin')))).toBe(true)
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

  it('行内标签两侧保留一个空格', () => {
    const node = parseFvg('<p>普通 <strong>加粗</strong> <em>强调</em> 结尾</p>')[0]!
    const segs = extractTextSegments(node, {
      fontFamily: 'ChillDuanSans',
      fontSize: 40,
      fontWeight: 400,
      color: '#000',
      letterSpacing: 0,
      lineHeightRatio: 1.2,
    })
    expect(segs.map((seg) => seg.text).join('')).toBe('普通 加粗 强调 结尾')
    expect(segs.find((seg) => seg.text.includes('强调'))?.style.fontStyle).toBe('italic')
  })

  it('最窄宽度', () => {
    if (!hasFont) return
    const segments: TextSegment[] = [{ text: '比特币', style: baseStyle }]
    const r = layoutText({ segments, maxWidth: 1000, lineHeightRatio: 1.2, fontSize: 40 })
    expect(r.minWidth).toBeGreaterThan(0)
  })

  it('行内 text-stroke 和 text-shadow 解析进样式', () => {
    const node = parseFvg(
      '<p style="text-stroke:2px #000; text-shadow:1px 2px 3px rgba(0,0,0,0.5)">外 <span style="text-stroke:4px #111; text-shadow:0px 0px 0px #fff">内</span></p>',
    )[0]!
    const invalid: string[] = []
    const segs = extractTextSegments(
      node,
      {
        fontFamily: 'ChillDuanSans',
        fontSize: 40,
        fontWeight: 400,
        color: '#000',
        letterSpacing: 0,
        lineHeightRatio: 1.2,
      },
      (label) => invalid.push(label),
    )
    expect(invalid).toEqual([])
    expect(segs[0]?.style.textStroke).toEqual({ width: 2, color: '#000' })
    expect(segs[0]?.style.textShadow?.[0]).toMatchObject({ x: 1, y: 2, blur: 3 })
    const inner = segs.find((seg) => seg.text === '内')
    expect(inner?.style.textStroke).toEqual({ width: 4, color: '#111' })
    expect(inner?.style.textShadow?.[0]?.color).toBe('#fff')
  })

  it('无法解析的 text-stroke 走 onInvalid', () => {
    const node = parseFvg('<p style="text-stroke:nope">A</p>')[0]!
    const invalid: string[] = []
    extractTextSegments(
      node,
      {
        fontFamily: 'ChillDuanSans',
        fontSize: 40,
        fontWeight: 400,
        color: '#000',
        letterSpacing: 0,
        lineHeightRatio: 1.2,
      },
      (label) => invalid.push(label),
    )
    expect(invalid).toContain('text-stroke')
  })
})

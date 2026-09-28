import type { FvgChild, FvgNode } from './parse.js'
import { buildFontString } from './fonts.js'
import { getMeasureCtx } from './measureCtx.js'
import { parseFontWeight, parsePx } from './style.js'
import type { Box, TextLayoutResult, TextRunStyle, TextSegment } from './types.js'
import { emptyBox, unionBoxes } from './types.js'

const INLINE_TAGS = new Set(['span', 'strong', 'b', 'em', 'br'])
const TEXT_BOX_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'div', 'span'])

const LINE_HEAD_FORBIDDEN = new Set('，。、；：？！）」』》】…'.split(''))
const LINE_TAIL_FORBIDDEN = new Set('（「『《【'.split(''))

const measureCache = new Map<string, number>()

function isCjk(ch: string): boolean {
  const c = ch.codePointAt(0)!
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x3000 && c <= 0x303f) ||
    (c >= 0xff00 && c <= 0xffef)
  )
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch)
}

export type TextBoxDefaults = {
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  letterSpacing: number
  lineHeightRatio: number
}

export function defaultFontSizeForTag(tag: string): number {
  switch (tag) {
    case 'h1':
      return 88
    case 'h2':
      return 64
    case 'h3':
      return 48
    default:
      return 40
  }
}

export function defaultFontWeightForTag(tag: string): number {
  return tag === 'h1' || tag === 'h2' || tag === 'h3' ? 700 : 400
}

function mergeStyle(base: TextRunStyle, styleMap: Record<string, string>): TextRunStyle {
  const next = { ...base }
  const fs = parsePx(styleMap['font-size'])
  if (fs != null) next.fontSize = fs
  const fw = parseFontWeight(styleMap['font-weight'])
  if (fw != null) next.fontWeight = fw
  if (styleMap['font-family']) next.fontFamily = styleMap['font-family'].trim()
  if (styleMap.color) next.color = styleMap.color.trim()
  const ls = parsePx(styleMap['letter-spacing'])
  if (ls != null) next.letterSpacing = ls
  return next
}

function parseStyleAttr(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  for (const decl of raw.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const k = decl.slice(0, i).trim().toLowerCase()
    const v = decl.slice(i + 1).trim()
    if (k && v) out[k] = v
  }
  return out
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function walkInline(
  nodes: FvgChild[],
  style: TextRunStyle,
  out: TextSegment[],
  hardBreakNext: boolean,
): void {
  let breakNext = hardBreakNext
  for (const child of nodes) {
    if (typeof child === 'string') {
      const t = collapseWhitespace(child)
      if (t) out.push({ text: t, style, hardBreakBefore: breakNext })
      breakNext = false
      continue
    }
    const tag = child.tag.toLowerCase()
    if (tag === 'br') {
      breakNext = true
      continue
    }
    if (!INLINE_TAGS.has(tag)) continue
    let segStyle = style
    if (tag === 'strong' || tag === 'b') segStyle = { ...style, fontWeight: 700 }
    if (tag === 'em') segStyle = { ...style, fontWeight: Math.min(900, style.fontWeight + 100) }
    segStyle = mergeStyle(segStyle, parseStyleAttr(child.attrs.style))
    walkInline(child.children, segStyle, out, breakNext)
    breakNext = false
  }
}

export function extractTextSegments(node: FvgNode, defaults: TextBoxDefaults): TextSegment[] {
  const base: TextRunStyle = {
    fontFamily: defaults.fontFamily,
    fontSize: defaults.fontSize,
    fontWeight: defaults.fontWeight,
    color: defaults.color,
    letterSpacing: defaults.letterSpacing,
  }
  const style = mergeStyle(base, parseStyleAttr(node.attrs.style))
  const segs: TextSegment[] = []
  walkInline(node.children, style, segs, false)
  return segs
}

type Unit = {
  text: string
  style: TextRunStyle
  width: number
  glueLeft: boolean
  glueRight: boolean
  isSpace: boolean
}

function measureTextWidth(text: string, style: TextRunStyle): number {
  if (!text) return 0
  const key = `${style.fontFamily}|${style.fontWeight}|${style.fontSize}|${style.letterSpacing}|${text}`
  const cached = measureCache.get(key)
  if (cached != null) return cached
  const ctx = getMeasureCtx()
  ctx.font = buildFontString(style.fontFamily, style.fontWeight, style.fontSize)
  ctx.letterSpacing = `${style.letterSpacing}px`
  const m = ctx.measureText(text)
  const w = m.width
  measureCache.set(key, w)
  return w
}

function measureInk(text: string, style: TextRunStyle): { width: number; ascent: number; descent: number } {
  const ctx = getMeasureCtx()
  ctx.font = buildFontString(style.fontFamily, style.fontWeight, style.fontSize)
  ctx.letterSpacing = `${style.letterSpacing}px`
  const m = ctx.measureText(text)
  return {
    width: m.width,
    ascent: m.actualBoundingBoxAscent ?? style.fontSize * 0.85,
    descent: m.actualBoundingBoxDescent ?? style.fontSize * 0.15,
  }
}

function segmentsToUnits(segments: TextSegment[]): Unit[] {
  const units: Unit[] = []
  for (const seg of segments) {
    if (seg.hardBreakBefore && units.length > 0) {
      units.push({
        text: '\u0000',
        style: seg.style,
        width: 0,
        glueLeft: false,
        glueRight: false,
        isSpace: false,
      })
    } else if (seg.hardBreakBefore && units.length === 0) {
      // 段首硬换行忽略
    }
    let i = 0
    const s = seg.text
    while (i < s.length) {
      const ch = s[i]!
      if (/\s/.test(ch)) {
        units.push({
          text: ' ',
          style: seg.style,
          width: measureTextWidth(' ', seg.style),
          glueLeft: true,
          glueRight: true,
          isSpace: true,
        })
        i++
        continue
      }
      if (isCjk(ch)) {
        units.push({
          text: ch,
          style: seg.style,
          width: measureTextWidth(ch, seg.style),
          glueLeft: false,
          glueRight: false,
          isSpace: false,
        })
        i++
        continue
      }
      if (isWordChar(ch)) {
        let j = i + 1
        while (j < s.length && isWordChar(s[j]!)) j++
        const word = s.slice(i, j)
        units.push({
          text: word,
          style: seg.style,
          width: measureTextWidth(word, seg.style),
          glueLeft: false,
          glueRight: false,
          isSpace: false,
        })
        i = j
        continue
      }
      units.push({
        text: ch,
        style: seg.style,
        width: measureTextWidth(ch, seg.style),
        glueLeft: false,
        glueRight: false,
        isSpace: false,
      })
      i++
    }
  }
  return units.filter((u) => u.text !== '\u0000' || u.width === 0)
}

function bindLineBreakUnits(units: Unit[]): Unit[][] {
  const groups: Unit[][] = []
  let cur: Unit[] = []
  for (const u of units) {
    if (u.text === '\u0000') {
      if (cur.length) groups.push(cur)
      cur = []
      continue
    }
    cur.push(u)
  }
  if (cur.length) groups.push(cur)
  return groups
}

function glueUnits(lineUnits: Unit[]): Unit[] {
  const out: Unit[] = []
  for (let i = 0; i < lineUnits.length; i++) {
    const u = lineUnits[i]!
    if (u.isSpace) {
      if (out.length > 0) {
        const prev = out[out.length - 1]!
        out[out.length - 1] = { ...prev, text: prev.text + u.text, width: prev.width + u.width }
      }
      continue
    }
    let text = u.text
    let style = u.style
    if (i + 1 < lineUnits.length) {
      const next = lineUnits[i + 1]!
      if (LINE_TAIL_FORBIDDEN.has(u.text.slice(-1)!) && !next.isSpace) {
        text += next.text
        i++
      }
    }
    if (out.length > 0) {
      const prev = out[out.length - 1]!
      if (LINE_HEAD_FORBIDDEN.has(text[0]!)) {
        out[out.length - 1] = {
          ...prev,
          text: prev.text + text,
          width: measureTextWidth(prev.text + text, prev.style),
        }
        continue
      }
    }
    out.push({ ...u, text, width: measureTextWidth(text, style) })
  }
  return out
}

function lineWidth(units: Unit[]): number {
  let w = 0
  for (let i = 0; i < units.length; i++) {
    w += units[i]!.width
    if (i > 0 && !units[i - 1]!.isSpace && !units[i]!.isSpace) {
      // letter spacing between non-space handled in measureText for whole tokens
    }
  }
  return w
}

function wrapParagraph(units: Unit[], maxWidth: number): Unit[][] {
  const lines: Unit[][] = []
  let line: Unit[] = []
  let curW = 0

  const flush = () => {
    if (line.length) {
      lines.push(glueUnits(line))
      line = []
      curW = 0
    }
  }

  for (const u of units) {
    if (u.text === '\u0000') {
      flush()
      continue
    }
    if (u.isSpace && line.length === 0) continue
    const w = u.width
    if (line.length > 0 && curW + w > maxWidth + 1e-3) {
      flush()
      if (u.isSpace) continue
    }
    if (!u.isSpace && w > maxWidth + 1e-3 && line.length === 0) {
      lines.push([u])
      continue
    }
    line.push(u)
    curW += w
  }
  flush()
  return lines.length ? lines : [[]]
}

function balanceWrap(units: Unit[], maxWidth: number): Unit[][] {
  const greedy = wrapParagraph(units, maxWidth)
  const n = greedy.length
  if (n <= 1) return greedy
  let lo = 0
  let hi = maxWidth
  let best = maxWidth
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    const lines = wrapParagraph(units, mid)
    if (lines.length <= n) {
      best = mid
      hi = mid
    } else {
      lo = mid
    }
  }
  return wrapParagraph(units, best)
}

export type LayoutTextOptions = {
  segments: TextSegment[]
  maxWidth?: number
  fixedWidth?: number
  fixedHeight?: number
  nowrap?: boolean
  textWrap?: 'balance' | 'wrap'
  lineHeightRatio: number
  fontSize: number
}

export function layoutText(opts: LayoutTextOptions): TextLayoutResult {
  const unitsRaw = segmentsToUnits(opts.segments)
  const paragraphGroups = bindLineBreakUnits(unitsRaw)
  const allLines: Unit[][] = []

  let minUnit = 0
  for (const u of unitsRaw) {
    if (!u.isSpace && u.text !== '\u0000') minUnit = Math.max(minUnit, u.width)
  }

  const effectiveMax =
    opts.fixedWidth ??
    opts.maxWidth ??
    (opts.nowrap ? Infinity : paragraphGroups.reduce((m, g) => m + lineWidth(g), 0))

  let autoWrap = false
  for (const group of paragraphGroups) {
    const natural = lineWidth(glueUnits(group.filter((u) => !u.isSpace)))
    if (!opts.fixedWidth && !opts.nowrap && opts.maxWidth != null && natural > opts.maxWidth + 1e-3) {
      autoWrap = true
    }
    if (opts.nowrap || effectiveMax === Infinity) {
      allLines.push(glueUnits(group.filter((u) => !u.isSpace)))
    } else if (opts.textWrap === 'wrap') {
      allLines.push(...wrapParagraph(group, effectiveMax))
    } else {
      allLines.push(...balanceWrap(group, effectiveMax))
    }
  }

  if (allLines.length === 0) allLines.push([])

  let contentWidth = 0
  let contentHeight = 0
  const laidLines: TextLayoutResult['lines'] = []
  let ink = emptyBox()
  let y = 0

  for (const lineUnits of allLines) {
    let lineW = 0
    let maxAsc = 0
    let maxDesc = 0
    const segOut: TextLayoutResult['lines'][0]['segments'] = []
    let x = 0
    for (const u of lineUnits) {
      const inkM = measureInk(u.text, u.style)
      maxAsc = Math.max(maxAsc, inkM.ascent)
      maxDesc = Math.max(maxDesc, inkM.descent)
      segOut.push({ text: u.text, style: u.style, x, width: u.width })
      x += u.width
      lineW = x
    }
    const lh = opts.lineHeightRatio * opts.fontSize
    const lineH = allLines.length === 1 ? Math.max(lh, maxAsc + maxDesc) : lh
    const baselineY = y + maxAsc + (lineH - (maxAsc + maxDesc)) / 2
    const lineInk: Box = {
      x: 0,
      y: baselineY - maxAsc,
      width: lineW,
      height: maxAsc + maxDesc,
    }
    ink = unionBoxes(ink, lineInk)
    laidLines.push({
      segments: segOut,
      width: lineW,
      height: lineH,
      baselineY,
      ink: lineInk,
    })
    contentWidth = Math.max(contentWidth, lineW)
    y += lineH
  }
  contentHeight = y

  let overflowFixed = false
  if (opts.fixedWidth != null && contentWidth > opts.fixedWidth + 1e-3) overflowFixed = true
  if (opts.fixedHeight != null && contentHeight > opts.fixedHeight + 1e-3) overflowFixed = true

  return {
    lines: laidLines,
    contentWidth,
    contentHeight,
    minWidth: minUnit,
    ink,
    fontSize: opts.fontSize,
    autoWrap,
    overflowFixed,
  }
}

export function isTextBoxTag(tag: string): boolean {
  return TEXT_BOX_TAGS.has(tag.toLowerCase())
}

export type StyleMap = Record<string, string>

export function parseStyle(text: string | undefined): StyleMap {
  const out: StyleMap = {}
  if (!text) return out
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl.slice(0, i).trim().toLowerCase()
    const value = decl.slice(i + 1).trim()
    if (key && value) out[key] = value
  }
  return out
}

/** 像素长度：数字或 `12px`；无法解析返回 undefined */
export function parsePx(value: string | undefined): number | undefined {
  if (value == null) return undefined
  const m = /^\s*(-?\d*\.?\d+)\s*(px)?\s*$/i.exec(value)
  return m ? Number.parseFloat(m[1]) : undefined
}

export function parseNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export type Edges = { top: number; right: number; bottom: number; left: number }

export const ZERO_EDGES: Edges = { top: 0, right: 0, bottom: 0, left: 0 }

/** 1 到 4 个值的边距（同 CSS padding 语法） */
export function parseEdges(value: string | undefined): Edges | undefined {
  if (value == null) return undefined
  const parts = value.trim().split(/\s+/).map(parsePx)
  if (parts.length === 0 || parts.length > 4 || parts.some((p) => p === undefined)) return undefined
  const [a, b = a, c = a, d = b] = parts as number[]
  return { top: a, right: b, bottom: c, left: d }
}

export type Border = { width: number; color: string }

/** `2px solid #fff`；只支持实线，顺序不限 */
export function parseBorder(value: string | undefined): Border | undefined {
  if (!value || value.trim() === 'none') return undefined
  let width = 1
  let color = '#000000'
  for (const token of splitCssTokens(value)) {
    const px = parsePx(token)
    if (px !== undefined) width = px
    else if (!/^(solid|dashed|dotted|double)$/i.test(token)) color = token
  }
  return width > 0 ? { width, color } : undefined
}

/** 按空白拆分，但保留括号内的空白（如 `rgb(1, 2, 3)`） */
function splitCssTokens(value: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) {
      if (cur) tokens.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) tokens.push(cur)
  return tokens
}

export type ShadowValue = { x: number; y: number; blur: number; spread: number; color?: string }
export type GlowValue = { blur: number; spread: number; color?: string }

function splitLengthsAndColor(value: string): { lengths: number[]; color?: string } | undefined {
  const lengths: number[] = []
  let color: string | undefined
  for (const token of splitCssTokens(value)) {
    const px = parsePx(token)
    if (px !== undefined) {
      if (color !== undefined) return undefined
      lengths.push(px)
    } else if (color === undefined) color = token
    else return undefined
  }
  return { lengths, color }
}

/** `x y [blur] [spread] [color]`，同 CSS box-shadow；无法解析返回 undefined */
export function parseShadow(value: string | undefined): ShadowValue | undefined {
  if (!value || value.trim() === 'none') return undefined
  const parts = splitLengthsAndColor(value)
  if (!parts || parts.lengths.length < 2 || parts.lengths.length > 4) return undefined
  const [x, y, blur = 0, spread = 0] = parts.lengths as [number, number, number?, number?]
  if (blur < 0) return undefined
  return { x, y, blur, spread, color: parts.color }
}

/** `blur [spread] [color]`；无法解析返回 undefined */
export function parseGlow(value: string | undefined): GlowValue | undefined {
  if (!value || value.trim() === 'none') return undefined
  const parts = splitLengthsAndColor(value)
  if (!parts || parts.lengths.length < 1 || parts.lengths.length > 2) return undefined
  const [blur, spread = 0] = parts.lengths as [number, number?]
  if (blur < 0) return undefined
  return { blur, spread, color: parts.color }
}

export function parseDashArray(value: string | undefined): number[] | undefined {
  if (!value || value.trim() === 'none') return undefined
  const parts = value.trim().split(/[\s,]+/).map(parsePx)
  if (parts.length === 0 || parts.some((p) => p === undefined || p < 0)) return undefined
  return parts as number[]
}

/** 角度：数字或 `15deg` */
export function parseAngle(value: string | undefined): number | undefined {
  if (value == null) return undefined
  const m = /^\s*(-?\d*\.?\d+)\s*(deg)?\s*$/i.exec(value)
  return m ? Number.parseFloat(m[1]) : undefined
}

export type OriginAxis = number | 'left' | 'center' | 'right'
export type OriginCross = number | 'top' | 'center' | 'bottom'

export type TransformOrigin = {
  x: OriginAxis
  y: OriginCross
}

export const CENTER_ORIGIN: TransformOrigin = { x: 'center', y: 'center' }

const ORIGIN_KEYWORDS: Record<string, TransformOrigin> = {
  center: CENTER_ORIGIN,
  top: { x: 'center', y: 'top' },
  bottom: { x: 'center', y: 'bottom' },
  left: { x: 'left', y: 'center' },
  right: { x: 'right', y: 'center' },
  'top-left': { x: 'left', y: 'top' },
  'left-top': { x: 'left', y: 'top' },
  'top-right': { x: 'right', y: 'top' },
  'right-top': { x: 'right', y: 'top' },
  'bottom-left': { x: 'left', y: 'bottom' },
  'left-bottom': { x: 'left', y: 'bottom' },
  'bottom-right': { x: 'right', y: 'bottom' },
  'right-bottom': { x: 'right', y: 'bottom' },
}

type AxisTok = { h?: 'left' | 'center' | 'right'; v?: 'top' | 'center' | 'bottom' }

function classifyOriginKeyword(token: string): AxisTok | undefined {
  if (token === 'center') return { h: 'center', v: 'center' }
  if (token === 'left' || token === 'right') return { h: token }
  if (token === 'top' || token === 'bottom') return { v: token }
  return undefined
}

/**
 * `transform-origin`：九宫格关键字，或两个像素（相对盒子左上角，先横后纵）。
 * 不接受百分比、em、rem 以及其它单位；关键字和像素不能混写。
 */
export function parseTransformOrigin(raw: string): TransformOrigin | undefined {
  const text = raw.trim().toLowerCase()
  if (!text) return undefined
  const direct = ORIGIN_KEYWORDS[text]
  if (direct) return direct

  const parts = text.split(/\s+/)
  if (parts.length !== 2) return undefined
  const [a, b] = parts as [string, string]
  const px = parsePx(a)
  const py = parsePx(b)
  if (px !== undefined || py !== undefined) {
    if (px === undefined || py === undefined) return undefined
    return { x: px, y: py }
  }

  const ca = classifyOriginKeyword(a)
  const cb = classifyOriginKeyword(b)
  if (!ca || !cb) return undefined

  let x: TransformOrigin['x'] | undefined
  let y: TransformOrigin['y'] | undefined
  for (const tok of [ca, cb]) {
    if (tok.h && !tok.v) {
      if (x !== undefined && x !== tok.h) return undefined
      x = tok.h
    }
    if (tok.v && !tok.h) {
      if (y !== undefined && y !== tok.v) return undefined
      y = tok.v
    }
  }
  for (const tok of [ca, cb]) {
    if (tok.h && tok.v) {
      if (x === undefined) x = 'center'
      if (y === undefined) y = 'center'
    }
  }
  if (x === undefined || y === undefined || typeof x === 'number' || typeof y === 'number') return undefined
  return { x, y }
}

/** 把原点解析成相对布局盒子左上角的像素。 */
export function resolveOrigin(origin: TransformOrigin, width: number, height: number): { x: number; y: number } {
  const x = typeof origin.x === 'number' ? origin.x : origin.x === 'left' ? 0 : origin.x === 'right' ? width : width / 2
  const y = typeof origin.y === 'number' ? origin.y : origin.y === 'top' ? 0 : origin.y === 'bottom' ? height : height / 2
  return { x, y }
}

export function parseFontWeight(value: string | undefined): number | undefined {
  if (!value) return undefined
  const v = value.trim().toLowerCase()
  if (v === 'normal') return 400
  if (v === 'bold') return 700
  if (v === 'lighter') return 300
  if (v === 'bolder') return 800
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : undefined
}

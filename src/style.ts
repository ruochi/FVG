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

export type BorderStyle = 'solid' | 'dashed' | 'dotted'

export type Border = { width: number; color: string; style: BorderStyle }

/** `2px solid #fff` 或 `2px dashed #fff`。`double` 按实线处理，顺序不限 */
export function parseBorder(value: string | undefined): Border | undefined {
  if (!value || value.trim() === 'none') return undefined
  let width = 1
  let color = '#000000'
  let style: BorderStyle = 'solid'
  for (const token of splitCssTokens(value)) {
    const px = parsePx(token)
    if (px !== undefined) width = px
    else if (/^dashed$/i.test(token)) style = 'dashed'
    else if (/^dotted$/i.test(token)) style = 'dotted'
    else if (!/^(solid|double)$/i.test(token)) color = token
  }
  return width > 0 ? { width, color, style } : undefined
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

/** `20 10` 或 `20,10`。`none` 表示不画虚线。无法解析返回 undefined。 */
export function parseDash(value: string | undefined): number[] | undefined {
  if (value == null) return undefined
  const v = value.trim()
  if (v === '' || v.toLowerCase() === 'none') return undefined
  const parts = v.split(/[\s,]+/).map((part) => parsePx(part))
  if (parts.length === 0 || parts.some((part) => part === undefined || part < 0)) return undefined
  return parts as number[]
}

export function parseLineCap(value: string | undefined): CanvasLineCap | undefined {
  const v = value?.trim().toLowerCase()
  if (v === 'butt' || v === 'round' || v === 'square') return v
  return undefined
}

export function parseLineJoin(value: string | undefined): CanvasLineJoin | undefined {
  const v = value?.trim().toLowerCase()
  if (v === 'miter' || v === 'round' || v === 'bevel') return v
  return undefined
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

/** 按逗号拆分，但保留括号内的逗号 */
export function splitList(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      if (cur.trim()) parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

export type Shadow = { x: number; y: number; blur: number; color: string }

/** `x y blur 颜色`，多层用逗号分隔。无法解析返回 null。 */
export function parseShadows(value: string): Shadow[] | null {
  const layers = splitList(value)
  if (layers.length === 0) return null
  const out: Shadow[] = []
  for (const layer of layers) {
    const tokens = splitCssTokens(layer)
    if (tokens.length < 4) return null
    const x = parsePx(tokens[0])
    const y = parsePx(tokens[1])
    const blur = parsePx(tokens[2])
    const color = tokens.slice(3).join(' ')
    if (x === undefined || y === undefined || blur === undefined || blur < 0 || !color) return null
    out.push({ x, y, blur, color })
  }
  return out
}

export type TextStroke = { width: number; color: string }

/** `4px #000000`，宽度和颜色顺序不限。无法解析返回 null。 */
export function parseTextStroke(value: string): TextStroke | null {
  const tokens = splitCssTokens(value)
  let width: number | undefined
  let color = ''
  for (const token of tokens) {
    const px = parsePx(token)
    if (px !== undefined && width === undefined) width = px
    else color = color ? `${color} ${token}` : token
  }
  if (width === undefined || width < 0 || !color) return null
  return { width, color }
}

export type ColorStop = { color: string; at?: number }

export type GradientFill =
  | { kind: 'linear'; angle: number; stops: ColorStop[] }
  | { kind: 'radial'; stops: ColorStop[] }

export type PaintFill = string | GradientFill

function parseColorStop(arg: string): ColorStop | null {
  const tokens = splitCssTokens(arg)
  if (tokens.length === 0 || tokens.length > 2) return null
  const color = tokens[0]!
  if (!color || parsePx(color) !== undefined) return null
  if (tokens.length === 1) return { color }
  const at = parsePx(tokens[1])
  if (at === undefined || at < 0) return null
  return { color, at }
}

/** CSS 角度：0 朝上，90 朝右。`to right` 为 90。 */
export function parseLinearDirection(arg: string): number | undefined {
  const deg = /^(-?\d*\.?\d+)deg$/i.exec(arg.trim())
  if (deg) return Number.parseFloat(deg[1]!)
  const to = /^to\s+(top|right|bottom|left)$/i.exec(arg.trim())
  if (!to) return undefined
  switch (to[1]!.toLowerCase()) {
    case 'top':
      return 0
    case 'right':
      return 90
    case 'bottom':
      return 180
    case 'left':
      return 270
    default:
      return undefined
  }
}

/**
 * 纯色原样返回（含 `none`）。
 * 渐变无法解析时返回 undefined。
 */
export function parsePaint(value: string | undefined): PaintFill | undefined {
  if (value == null) return undefined
  const v = value.trim()
  if (!v) return undefined
  const linear = /^linear-gradient\(([\s\S]*)\)\s*$/i.exec(v)
  const radial = /^radial-gradient\(([\s\S]*)\)\s*$/i.exec(v)
  if (!linear && !radial) return v
  const args = splitList((linear ?? radial)![1] ?? '')
  if (args.length === 0) return undefined
  let stopArgs = args
  let angle = 180
  if (linear) {
    const dir = parseLinearDirection(args[0] ?? '')
    if (dir !== undefined) {
      angle = dir
      stopArgs = args.slice(1)
    }
  } else if (/^(circle|ellipse)$/i.test(args[0] ?? '')) {
    stopArgs = args.slice(1)
  }
  const stops: ColorStop[] = []
  for (const arg of stopArgs) {
    const stop = parseColorStop(arg)
    if (!stop) return undefined
    stops.push(stop)
  }
  if (stops.length < 2) return undefined
  return linear ? { kind: 'linear', angle, stops } : { kind: 'radial', stops }
}

export type CornerRadii = { tl: number; tr: number; br: number; bl: number }

/** 左上、右上、右下、左下。两值时对角相同，三值时左右用第二个值。 */
export function parseCorners(value: string | undefined): CornerRadii | undefined {
  if (value == null || value.trim() === '') return undefined
  const parts = value.trim().split(/\s+/).map((part) => parsePx(part))
  if (parts.length === 0 || parts.length > 4 || parts.some((part) => part === undefined)) return undefined
  const [a, b, c, d] = parts as number[]
  if (parts.length === 1) return { tl: a!, tr: a!, br: a!, bl: a! }
  if (parts.length === 2) return { tl: a!, tr: b!, br: a!, bl: b! }
  if (parts.length === 3) return { tl: a!, tr: b!, br: c!, bl: b! }
  return { tl: a!, tr: b!, br: c!, bl: d! }
}

export function parseObjectFit(value: string | undefined): 'fill' | 'contain' | 'cover' | undefined {
  const v = value?.trim().toLowerCase()
  if (v === 'fill' || v === 'contain' || v === 'cover') return v
  return undefined
}

export function parseOverflow(value: string | undefined): 'visible' | 'hidden' | undefined {
  const v = value?.trim().toLowerCase()
  if (v === 'visible' || v === 'hidden') return v
  return undefined
}

export function parseZIndex(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined
  if (!/^-?\d+$/.test(value.trim())) return undefined
  return Number.parseInt(value.trim(), 10)
}

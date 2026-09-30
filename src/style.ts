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
export type NoiseValue = { amount: number; color?: string }
export type ColorFilterFn =
  | { name: 'brightness' | 'contrast' | 'saturate' | 'grayscale' | 'sepia' | 'invert'; value: number }
  | { name: 'hue-rotate'; value: number }

export const BLEND_MODES = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'lighten',
  'darken',
] as const
export type BlendMode = (typeof BLEND_MODES)[number]

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

/** `x y [blur] [spread] [color]`，同 CSS box-shadow。无法解析返回 undefined。 */
export function parseShadow(value: string | undefined): ShadowValue | undefined {
  if (!value || value.trim() === 'none') return undefined
  const parts = splitLengthsAndColor(value)
  if (!parts || parts.lengths.length < 2 || parts.lengths.length > 4) return undefined
  const [x, y, blur = 0, spread = 0] = parts.lengths as [number, number, number?, number?]
  if (blur < 0) return undefined
  return { x, y, blur, spread, color: parts.color }
}

/** `blur [spread] [color]`。无法解析返回 undefined。 */
export function parseGlow(value: string | undefined): GlowValue | undefined {
  if (!value || value.trim() === 'none') return undefined
  const parts = splitLengthsAndColor(value)
  if (!parts || parts.lengths.length < 1 || parts.lengths.length > 2) return undefined
  const [blur, spread = 0] = parts.lengths as [number, number?]
  if (blur < 0) return undefined
  return { blur, spread, color: parts.color }
}

/** 单个非负长度，如 `12` / `12px`。 */
export function parseBlurRadius(value: string | undefined): number | undefined {
  if (!value || value.trim() === 'none') return undefined
  const n = parsePx(value)
  if (n === undefined || n < 0) return undefined
  return n
}

/** `0.08` 或 `0.08 #ffffff`，强度 0 到 1。 */
export function parseNoise(value: string | undefined): NoiseValue | undefined {
  if (!value || value.trim() === 'none') return undefined
  const tokens = splitCssTokens(value)
  if (tokens.length < 1 || tokens.length > 2) return undefined
  const amount = Number(tokens[0])
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) return undefined
  const color = tokens[1]
  if (color !== undefined && parsePx(color) !== undefined) return undefined
  return { amount, color }
}

const COLOR_FILTER_NAMES = new Set([
  'brightness',
  'contrast',
  'saturate',
  'grayscale',
  'sepia',
  'invert',
  'hue-rotate',
])

function parseFilterArg(raw: string, kind: 'ratio' | 'angle'): number | undefined {
  const t = raw.trim()
  if (kind === 'angle') {
    const m = /^(-?\d*\.?\d+)\s*(deg)?$/i.exec(t)
    return m ? Number.parseFloat(m[1]!) : undefined
  }
  const pct = /^(-?\d*\.?\d+)\s*%$/.exec(t)
  if (pct) return Number.parseFloat(pct[1]!) / 100
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** 色彩滤镜：`brightness(1.1) contrast(1.2) …`，不含 blur / drop-shadow。 */
export function parseColorFilter(value: string | undefined): ColorFilterFn[] | undefined {
  if (!value || value.trim() === 'none') return undefined
  const out: ColorFilterFn[] = []
  const re = /([a-z-]+)\(\s*([^)]*?)\s*\)/gi
  let m: RegExpExecArray | null
  let consumed = 0
  while ((m = re.exec(value))) {
    const name = m[1]!.toLowerCase()
    if (!COLOR_FILTER_NAMES.has(name)) return undefined
    if (name === 'blur' || name === 'drop-shadow') return undefined
    const arg = parseFilterArg(m[2]!, name === 'hue-rotate' ? 'angle' : 'ratio')
    if (arg === undefined) return undefined
    out.push({ name: name as ColorFilterFn['name'], value: arg })
    consumed = m.index + m[0].length
  }
  if (out.length === 0) return undefined
  if (value.slice(consumed).trim() !== '') return undefined
  // 拒绝整串里夹了未匹配的标识
  const stripped = value.replace(/[a-z-]+\(\s*[^)]*?\)/gi, '').trim()
  if (stripped !== '') return undefined
  return out
}

/** 转成 canvas `filter` 字符串。 */
export function colorFilterToCss(fns: ColorFilterFn[]): string {
  return fns
    .map((fn) => (fn.name === 'hue-rotate' ? `hue-rotate(${fn.value}deg)` : `${fn.name}(${fn.value})`))
    .join(' ')
}

export function parseBlend(value: string | undefined): BlendMode | undefined {
  if (!value || value.trim() === 'none') return undefined
  const v = value.trim().toLowerCase()
  return (BLEND_MODES as readonly string[]).includes(v) ? (v as BlendMode) : undefined
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

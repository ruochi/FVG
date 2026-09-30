import type { CanvasRenderingContext2D } from '@napi-rs/canvas'
import { isGradientPaint, parseFieldGradient, rgbaToCss, sampleGradient } from './gradientField.js'

export { isGradientPaint, sampleGradient }

export type GradientStop = { color: string; offset: number }

export type Gradient = {
  kind: 'linear' | 'radial'
  /** CSS 角度：0 朝上，顺时针。线性渐变默认 180，也就是从上到下。 */
  angle: number
  /** 径向渐变的圆心，相对元素盒子的 0 到 1。 */
  at: { x: number; y: number }
  stops: GradientStop[]
}

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)$/

function splitArgs(value: string): string[] {
  const args: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      if (cur.trim()) args.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) args.push(cur.trim())
  return args
}

function directionAngle(token: string): number | undefined {
  const text = token.trim().toLowerCase().replace(/\s+/g, ' ')
  const named: Record<string, number> = {
    'to top': 0,
    'to right': 90,
    'to bottom': 180,
    'to left': 270,
    'to top right': 45,
    'to right top': 45,
    'to bottom right': 135,
    'to right bottom': 135,
    'to bottom left': 225,
    'to left bottom': 225,
    'to top left': 315,
    'to left top': 315,
  }
  if (text in named) return named[text]
  const angle = /^(-?\d*\.?\d+)deg$/.exec(text)
  return angle ? Number(angle[1]) : undefined
}

function parseOffset(token: string | undefined): number | undefined {
  if (token == null) return undefined
  const text = token.trim()
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : undefined
  }
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined
}

function parseStop(arg: string): { color: string; offset?: number } | undefined {
  const parts = arg.trim().split(/\s+/)
  if (parts.length === 0 || parts.length > 2) return undefined
  const color = parts[0]!
  if (!COLOR.test(color)) return undefined
  if (parts.length === 1) return { color }
  const offset = parseOffset(parts[1])
  if (offset == null) return undefined
  return { color, offset }
}

function assignOffsets(stops: Array<{ color: string; offset?: number }>): GradientStop[] | undefined {
  if (stops.length === 0) return undefined
  const out: GradientStop[] = stops.map((stop) => ({ color: stop.color, offset: stop.offset ?? Number.NaN }))
  if (out[0]!.offset !== out[0]!.offset) out[0]!.offset = 0
  if (out[out.length - 1]!.offset !== out[out.length - 1]!.offset) out[out.length - 1]!.offset = 1
  let i = 0
  while (i < out.length) {
    if (out[i]!.offset === out[i]!.offset) {
      i++
      continue
    }
    const start = i - 1
    let end = i + 1
    while (end < out.length && out[end]!.offset !== out[end]!.offset) end++
    const left = out[start]!.offset
    const right = out[end]!.offset
    const span = end - start
    for (let k = 1; k < span; k++) out[start + k]!.offset = left + ((right - left) * k) / span
    i = end
  }
  return out
}

/** 解析 `linear-gradient(...)` / `radial-gradient(...)`。不是这种写法时返回 undefined。 */
export function parseCssGradient(value: string | undefined): Gradient | undefined {
  if (!value) return undefined
  const match = /^(linear-gradient|radial-gradient)\(([\s\S]*)\)$/i.exec(value.trim())
  if (!match) return undefined
  const kind = match[1]!.toLowerCase().startsWith('radial') ? 'radial' : 'linear'
  const args = splitArgs(match[2]!)
  if (args.length === 0) return undefined
  let angle = 180
  let at = { x: 0.5, y: 0.5 }
  let index = 0
  const first = args[0]!
  if (kind === 'linear') {
    const parsed = directionAngle(first)
    if (parsed != null) {
      angle = parsed
      index = 1
    }
  } else if (/^at\s+/i.test(first)) {
    const parts = first.replace(/^at\s+/i, '').trim().split(/\s+/)
    const x = parseOffset(parts[0])
    const y = parseOffset(parts[1] ?? parts[0])
    if (x == null || y == null) return undefined
    at = { x, y }
    index = 1
  }
  const parsedStops = args.slice(index).map(parseStop)
  if (parsedStops.some((stop) => stop == null)) return undefined
  const stops = assignOffsets(parsedStops as Array<{ color: string; offset?: number }>)
  if (!stops || stops.length === 0) return undefined
  return { kind, angle, at, stops }
}

export function isGradient(value: string | undefined): boolean {
  if (value == null) return false
  const text = value.trim()
  return isGradientPaint(text) || /^(linear-gradient|radial-gradient)\(/i.test(text)
}

/**
 * `gradient()` 返回矩阵渐变；`linear-gradient` / `radial-gradient` 返回 CSS 渐变。
 * 写了 `gradient()` 但解析失败时返回 null。
 */
export function parseGradient(value: string | undefined): Gradient | ReturnType<typeof parseFieldGradient> | undefined {
  if (value != null && isGradientPaint(value)) return parseFieldGradient(value)
  return parseCssGradient(value)
}

/** 渐变取第一个色标，给光晕默认色用。普通颜色原样返回。 */
export function solidPaint(value: string | undefined, fallback: string): string {
  if (!value || value === 'none' || value === 'transparent') return fallback
  if (isGradientPaint(value)) {
    const field = parseFieldGradient(value)
    if (!field) return fallback
    return rgbaToCss(field.first)
  }
  const gradient = parseCssGradient(value)
  if (gradient) return gradient.stops[0]?.color ?? fallback
  return value
}

export function canvasPaint(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
): string | ReturnType<CanvasRenderingContext2D['createLinearGradient']> {
  const gradient = parseCssGradient(value)
  if (!gradient) return value
  const width = Math.max(w, 1)
  const height = Math.max(h, 1)
  if (gradient.kind === 'radial') {
    const cx = x + gradient.at.x * width
    const cy = y + gradient.at.y * height
    const radius = Math.max(
      Math.hypot(cx - x, cy - y),
      Math.hypot(x + width - cx, cy - y),
      Math.hypot(cx - x, y + height - cy),
      Math.hypot(x + width - cx, y + height - cy),
    )
    const paint = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(radius, 1))
    for (const stop of gradient.stops) paint.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color)
    return paint
  }
  const radians = (gradient.angle * Math.PI) / 180
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const length = Math.abs(width * dx) + Math.abs(height * dy)
  const cx = x + width / 2
  const cy = y + height / 2
  const paint = ctx.createLinearGradient(cx - (dx * length) / 2, cy - (dy * length) / 2, cx + (dx * length) / 2, cy + (dy * length) / 2)
  for (const stop of gradient.stops) paint.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color)
  return paint
}

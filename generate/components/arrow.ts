import { createHostElement, type FvgHostElement } from '../serialize.js'

/** 生成层 Arrow 的参数。几何只在这里算一次。 */
export type ArrowProps = {
  x1: number | string
  y1: number | string
  x2: number | string
  y2: number | string
  /** 箭头两边的长度。缺省时为线宽的 4 倍，至少 12 */
  head?: number | string
  /** 线色，同时填箭头。默认 #111111 */
  stroke?: string
  strokeWidth?: number | string
  'stroke-width'?: number | string
  id?: string
}

function coord(value: number | string | undefined, name: string): number {
  if (value == null || value === '') throw new Error(`Arrow 缺少 ${name}`)
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) throw new Error(`Arrow 无法解析 ${name}：${value}`)
  return n
}

function lengthOf(value: number | string | undefined, name: string): number | undefined {
  if (value == null || value === '') return undefined
  const raw = typeof value === 'number' ? String(value) : String(value).trim().replace(/px$/i, '')
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) throw new Error(`Arrow 无法解析 ${name}：${value}`)
  return n
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** 展开成 layer，里面是一条 line 和一个填色 polygon。 */
export function arrowElement(props: ArrowProps): FvgHostElement {
  const x1 = coord(props.x1, 'x1')
  const y1 = coord(props.y1, 'y1')
  const x2 = coord(props.x2, 'x2')
  const y2 = coord(props.y2, 'y2')
  const strokeWidth = lengthOf(props.strokeWidth ?? props['stroke-width'], 'strokeWidth') ?? 4
  const head = lengthOf(props.head, 'head') ?? Math.max(12, strokeWidth * 4)
  const stroke = props.stroke?.trim() || '#111111'
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const wing = (delta: number) => {
    const x = x2 - head * Math.cos(ang + delta)
    const y = y2 - head * Math.sin(ang + delta)
    return `${fmt(x)},${fmt(y)}`
  }
  const layer = createHostElement('layer')
  if (props.id) layer.props.id = props.id
  const line = createHostElement('line')
  line.props = {
    x1,
    y1,
    x2,
    y2,
    style: `stroke:${stroke}; stroke-width:${fmt(strokeWidth)}px`,
  }
  const polygon = createHostElement('polygon')
  polygon.props = {
    points: `${fmt(x2)},${fmt(y2)} ${wing(-Math.PI / 6)} ${wing(Math.PI / 6)}`,
    style: `fill:${stroke}`,
  }
  layer.children = [line, polygon]
  return layer
}

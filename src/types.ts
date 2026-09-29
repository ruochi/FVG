import type { CanvasRenderingContext2D } from '@napi-rs/canvas'

export type StyleMap = Record<string, string>

export type DrawComputedStyle = {
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  opacity: number
}

export type DrawElSnapshot = {
  tag: string
  id?: string
  text: string
  attr: Record<string, string>
  style: StyleMap
  computed: DrawComputedStyle
  w: number
  h: number
  /** 当前帧的时间，单位秒。单帧渲染缺省为 0。 */
  t: number
}

export type DrawFn = (ctx: CanvasRenderingContext2D, el: DrawElSnapshot) => void

export type Box = {
  x: number
  y: number
  width: number
  height: number
}

export type Rect = Box & {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

export function boxToRect(b: Box): Rect {
  return {
    ...b,
    left: b.x,
    top: b.y,
    right: b.x + b.width,
    bottom: b.y + b.height,
    centerX: b.x + b.width / 2,
    centerY: b.y + b.height / 2,
  }
}

export function unionBoxes(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

export function emptyBox(): Box {
  return { x: 0, y: 0, width: 0, height: 0 }
}

export function translateBox(b: Box, dx: number, dy: number): Box {
  return { ...b, x: b.x + dx, y: b.y + dy }
}

export type IssueLevel = 'error' | 'warn' | 'info'

export type Issue = {
  level: IssueLevel
  code: string
  path: string
  message: string
}

export type Anchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type TextLineReport = {
  text: string
  box: Rect
}

export type ElementReport = {
  path: string
  id?: string
  tag: string
  box: Rect
  ink: Rect
  fontSize?: number
  lines?: TextLineReport[]
}

export type FvgReport = {
  fvg: string
  width: number
  height: number
  elements: ElementReport[]
  issues: Issue[]
}

export type TextRunStyle = {
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  letterSpacing: number
}

export type TextSegment = {
  text: string
  style: TextRunStyle
  hardBreakBefore?: boolean
}

export type LaidTextLine = {
  segments: Array<{ text: string; style: TextRunStyle; x: number; width: number }>
  width: number
  height: number
  baselineY: number
  ink: Box
}

export type TextLayoutResult = {
  lines: LaidTextLine[]
  contentWidth: number
  contentHeight: number
  minWidth: number
  ink: Box
  fontSize: number
  autoWrap: boolean
  overflowFixed: boolean
}

export type ShapeKind = 'rect' | 'circle' | 'ellipse'

export type LineGeometry =
  | { kind: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; head?: number }
  | { kind: 'polyline' | 'polygon'; points: Array<{ x: number; y: number }> }
  | { kind: 'path'; d: string }

export type LayoutNodeBase = {
  path: string
  id?: string
  tag: string
  x: number
  y: number
  width: number
  height: number
  ink: Box
  opacity: number
  rotate: number
  scale: number
  background?: string
  border?: { width: number; color: string }
  borderRadius?: number
  padding: { top: number; right: number; bottom: number; left: number }
  draw?: DrawFn
  attr: Record<string, string>
  style: StyleMap
  computed: DrawComputedStyle
  text: string
}

export type LayerLayoutNode = LayoutNodeBase & {
  kind: 'layer'
  children: LayoutNode[]
}

export type FlexLayoutNode = LayoutNodeBase & {
  kind: 'flex'
  direction: 'row' | 'column'
  children: LayoutNode[]
}

export type TextLayoutNode = LayoutNodeBase & {
  kind: 'text'
  textLayout: TextLayoutResult
  textAlign: 'left' | 'center' | 'right'
}

export type ShapeLayoutNode = LayoutNodeBase & {
  kind: 'shape'
  shape: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
  rx?: number
  r?: number
  rxEllipse?: number
  ry?: number
}

export type LineLayoutNode = LayoutNodeBase & {
  kind: 'line'
  geometry: LineGeometry
  stroke: string
  strokeWidth: number
  fill: string
  strokeLinecap?: CanvasLineCap
  strokeLinejoin?: CanvasLineJoin
  dash?: number[]
}

export type CustomLayoutNode = LayoutNodeBase & {
  kind: 'custom'
}

export type SqrtLayoutNode = LayoutNodeBase & {
  kind: 'sqrt'
  surdWidth: number
  color: string
  thickness: number
  child: LayoutNode
}

export type LayoutNode =
  | LayerLayoutNode
  | FlexLayoutNode
  | TextLayoutNode
  | ShapeLayoutNode
  | LineLayoutNode
  | CustomLayoutNode
  | SqrtLayoutNode

export type FvgDocument = {
  width: number
  height: number
  background: string
  color: string
  fontFamily: string
  safe: { top: number; right: number; bottom: number; left: number }
  root: LayerLayoutNode
  issues: Issue[]
}

export type RenderOptions = {
  scale?: number
  debug?: boolean
  baseDir?: string
  fontsCacheDir?: string
  /** 当前帧的时间，单位秒。缺省为 0。 */
  t?: number
}

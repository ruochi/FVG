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

export type ShadowSpec = { x: number; y: number; blur: number; spread: number; color: string }

export type GlowSpec = { blur: number; spread: number; color: string }

export type ElementReport = {
  path: string
  id?: string
  tag: string
  /** 开标签在源码中的行号（1-based） */
  line?: number
  box: Rect
  ink: Rect
  /** 阴影和光晕实际可能画到的范围 */
  effect?: Rect
  shadow?: ShadowSpec
  glow?: GlowSpec
  fontSize?: number
  lines?: TextLineReport[]
  padding?: { top: number; right: number; bottom: number; left: number }
  border?: number
  /** Row/Column 写明的 gap */
  gap?: number
  direction?: 'row' | 'column'
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

export type LineCap = 'butt' | 'round' | 'square'

export type LineJoin = 'miter' | 'round' | 'bevel'

export type LineGeometry =
  | { kind: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; head?: number }
  | { kind: 'polyline' | 'polygon'; points: Array<{ x: number; y: number }> }
  /** d 保持原样；offsetX/offsetY 把它挪到线条自己的盒子里 */
  | { kind: 'path'; d: string; offsetX?: number; offsetY?: number }

export type LayoutNodeBase = {
  path: string
  id?: string
  tag: string
  line?: number
  x: number
  y: number
  width: number
  height: number
  ink: Box
  opacity: number
  rotate: number
  scale: number
  shadow?: ShadowSpec
  glow?: GlowSpec
  background?: string
  border?: { width: number; color: string }
  borderRadius?: number
  padding: { top: number; right: number; bottom: number; left: number }
}

export type LayerLayoutNode = LayoutNodeBase & {
  kind: 'layer'
  children: LayoutNode[]
}

export type FlexLayoutNode = LayoutNodeBase & {
  kind: 'flex'
  direction: 'row' | 'column'
  gap: number
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
  dash?: number[]
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
  strokeLinecap?: LineCap
  strokeLinejoin?: LineJoin
  dash?: number[]
}

export type LayoutNode =
  | LayerLayoutNode
  | FlexLayoutNode
  | TextLayoutNode
  | ShapeLayoutNode
  | LineLayoutNode

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
}

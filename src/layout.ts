import { Path2D } from '@napi-rs/canvas'
import {
  Align,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  type Config as YogaConfig,
  type Node as YogaNode,
} from 'yoga-layout/load'
import type { FvgNode } from './parse.js'
import { parseFvg } from './parse.js'
import { registerFontsFromDocument } from './fonts.js'
import {
  parseBorder,
  parseEdges,
  parseFontWeight,
  parseNumber,
  parsePx,
  parseStyle,
  ZERO_EDGES,
  type Edges,
} from './style.js'
import {
  defaultFontSizeForTag,
  defaultFontWeightForTag,
  extractTextSegments,
  isTextBoxTag,
  layoutText,
} from './text.js'
import { FONT_TAG, isFlexTag, isLineTag, isShapeTag, ROOT_TAGS } from './tags.js'
import type {
  Anchor,
  Box,
  CustomLayoutNode,
  DrawComputedStyle,
  FlexLayoutNode,
  FvgDocument,
  Issue,
  LayerLayoutNode,
  LayoutNode,
  LineGeometry,
  LineLayoutNode,
  ShapeLayoutNode,
  TextLayoutNode,
} from './types.js'
import { emptyBox, translateBox, unionBoxes } from './types.js'
import { ensureYoga, getYoga } from './yoga.js'

export type LayoutContext = {
  color: string
  fontFamily: string
  maxContentWidth: number
  issues: Issue[]
  pathPrefix: string
  /** 测量回调里为 false，避免 Yoga 多次求尺寸时重复记 issue */
  reportIssues?: boolean
}

function parseAnchor(raw: string | undefined): Anchor {
  const v = (raw ?? 'center').trim().toLowerCase() as Anchor
  const allowed: Anchor[] = [
    'center',
    'top',
    'bottom',
    'left',
    'right',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]
  return allowed.includes(v) ? v : 'center'
}

function anchorTopLeft(cx: number, cy: number, w: number, h: number, anchor: Anchor): { x: number; y: number } {
  switch (anchor) {
    case 'top-left':
      return { x: cx, y: cy }
    case 'top':
      return { x: cx - w / 2, y: cy }
    case 'top-right':
      return { x: cx - w, y: cy }
    case 'left':
      return { x: cx, y: cy - h / 2 }
    case 'right':
      return { x: cx - w, y: cy - h / 2 }
    case 'bottom-left':
      return { x: cx, y: cy - h }
    case 'bottom':
      return { x: cx - w / 2, y: cy - h }
    case 'bottom-right':
      return { x: cx - w, y: cy - h }
    default:
      return { x: cx - w / 2, y: cy - h / 2 }
  }
}

function parseSafe(raw: string | undefined, w: number, h: number): Edges {
  const def = Math.round(Math.min(w, h) * 0.04)
  if (!raw?.trim()) return { top: def, right: def, bottom: def, left: def }
  const parts = raw.trim().split(/\s+/).map((p) => parsePx(p) ?? def)
  if (parts.length === 1) return { top: parts[0]!, right: parts[0]!, bottom: parts[0]!, left: parts[0]! }
  if (parts.length === 2) return { top: parts[0]!, right: parts[1]!, bottom: parts[0]!, left: parts[1]! }
  if (parts.length === 3) return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[1]! }
  return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! }
}

function nodePath(prefix: string, tag: string, index: number): string {
  return `${prefix}/${tag}[${index}]`
}

function readAppearance(attrs: Record<string, string>, style: Record<string, string>, ctx: LayoutContext) {
  const padding = parseEdges(style.padding) ?? ZERO_EDGES
  const border = parseBorder(style.border)
  const borderRadius = parsePx(style['border-radius']) ?? 0
  const background = style.background ?? style['background-color']
  return {
    padding,
    border,
    borderRadius,
    background,
    opacity: parseNumber(attrs.opacity) ?? 1,
    rotate: parseNumber(attrs.rotate) ?? 0,
    scale: parseNumber(attrs.scale) ?? 1,
  }
}

function directTextContent(node: FvgNode): string {
  const parts: string[] = []
  for (const c of node.children) {
    if (typeof c === 'string') {
      const t = c.replace(/\s+/g, ' ').trim()
      if (t) parts.push(t)
    }
  }
  return parts.join(' ')
}

function computeDrawStyle(node: FvgNode, ctx: LayoutContext, style: Record<string, string>): DrawComputedStyle {
  const tag = node.tag.toLowerCase()
  const fontSize =
    parsePx(style['font-size']) ?? (isTextBoxTag(node.tag) ? defaultFontSizeForTag(tag) : 40)
  const fontWeight =
    parseFontWeight(style['font-weight']) ?? (isTextBoxTag(node.tag) ? defaultFontWeightForTag(tag) : 400)
  const fontFamily = style['font-family']?.trim() || ctx.fontFamily
  const color = style.color ?? ctx.color
  const opacity = parseNumber(node.attrs.opacity) ?? 1
  return { color, fontFamily, fontSize, fontWeight, opacity }
}

function layoutDrawMeta(node: FvgNode, ctx: LayoutContext) {
  const style = parseStyle(node.attrs.style)
  return {
    draw: node.draw,
    attr: { ...node.attrs },
    style,
    computed: computeDrawStyle(node, ctx, style),
    text: directTextContent(node),
  }
}

function layoutCustomDraw(node: FvgNode, ctx: LayoutContext): CustomLayoutNode | null {
  if (!node.draw) return null
  const style = parseStyle(node.attrs.style)
  const w = parsePx(style.width) ?? parseNumber(node.attrs.width)
  const h = parsePx(style.height) ?? parseNumber(node.attrs.height)
  if (w == null || h == null) return null
  const appearance = readAppearance(node.attrs, style, ctx)
  return {
    kind: 'custom',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: w,
    height: h,
    ink: { x: 0, y: 0, width: w, height: h },
    ...appearance,
    ...layoutDrawMeta(node, ctx),
  }
}

function layoutUnknownOrCustom(node: FvgNode, ctx: LayoutContext): LayoutNode | null {
  const custom = layoutCustomDraw(node, ctx)
  if (custom) return custom
  ctx.issues.push({ level: 'warn', code: 'unknown-tag', path: ctx.pathPrefix, message: `未知标签 ${node.tag}` })
  return null
}

function outerFromContent(
  contentW: number,
  contentH: number,
  padding: Edges,
  border?: { width: number; color: string },
): { width: number; height: number; contentOffsetX: number; contentOffsetY: number } {
  const bw = border?.width ?? 0
  const width = contentW + padding.left + padding.right + bw * 2
  const height = contentH + padding.top + padding.bottom + bw * 2
  return { width, height, contentOffsetX: padding.left + bw, contentOffsetY: padding.top + bw }
}

function mapJustify(v: string | undefined): Justify {
  switch ((v ?? 'start').trim()) {
    case 'center':
      return Justify.Center
    case 'end':
      return Justify.FlexEnd
    case 'space-between':
      return Justify.SpaceBetween
    case 'space-around':
      return Justify.SpaceAround
    case 'space-evenly':
      return Justify.SpaceEvenly
    default:
      return Justify.FlexStart
  }
}

function mapAlign(v: string | undefined): Align {
  switch ((v ?? 'center').trim()) {
    case 'start':
      return Align.FlexStart
    case 'end':
      return Align.FlexEnd
    case 'stretch':
      return Align.Stretch
    default:
      return Align.Center
  }
}

function parseFlexGrowShrink(style: Record<string, string>, isText: boolean): { grow: number; shrink: number } {
  const flex = style.flex?.trim()
  if (flex === '1') return { grow: 1, shrink: 1 }
  const grow = parseNumber(style['flex-grow']) ?? 0
  const shrink = parseNumber(style['flex-shrink']) ?? (isText ? 1 : 0)
  return { grow, shrink }
}

function lineBounds(geom: LineGeometry, strokeWidth: number): Box {
  const pad = strokeWidth / 2 + 4
  if (geom.kind === 'line' || geom.kind === 'arrow') {
    const x = Math.min(geom.x1, geom.x2) - pad
    const y = Math.min(geom.y1, geom.y2) - pad
    const w = Math.abs(geom.x2 - geom.x1) + pad * 2
    const h = Math.abs(geom.y2 - geom.y1) + pad * 2
    return { x, y, width: w, height: h }
  }
  if (geom.kind === 'polyline' || geom.kind === 'polygon') {
    const xs = geom.points.map((p) => p.x)
    const ys = geom.points.map((p) => p.y)
    const minX = Math.min(...xs) - pad
    const minY = Math.min(...ys) - pad
    const maxX = Math.max(...xs) + pad
    const maxY = Math.max(...ys) + pad
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  if (geom.kind === 'path') {
    const p = new Path2D(geom.d)
    const b = p.getBounds?.() ?? p.computeTightBounds?.()
    if (b && b.length >= 4) {
      return { x: b[0] - pad, y: b[1] - pad, width: b[2] - b[0] + pad * 2, height: b[3] - b[1] + pad * 2 }
    }
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

function normalizeLineGeometry(geom: LineGeometry, box: Box): LineGeometry {
  const ox = box.x
  const oy = box.y
  if (geom.kind === 'line' || geom.kind === 'arrow') {
    return { ...geom, x1: geom.x1 - ox, y1: geom.y1 - oy, x2: geom.x2 - ox, y2: geom.y2 - oy }
  }
  if (geom.kind === 'polyline' || geom.kind === 'polygon') {
    return { ...geom, points: geom.points.map((p) => ({ x: p.x - ox, y: p.y - oy })) }
  }
  return geom
}

function shouldReport(ctx: LayoutContext): boolean {
  return ctx.reportIssues !== false
}

type TextBoxOptions = {
  /** 作者没写 width 时的换行上限，指内容宽度 */
  contentWidthLimit?: number
  /** flex 最终外框。有值时盒子用这个尺寸，不再缩回文字本宽 */
  outerWidth?: number
  outerHeight?: number
}

function layoutTextBox(node: FvgNode, ctx: LayoutContext, opts?: TextBoxOptions): TextLayoutNode {
  const style = parseStyle(node.attrs.style)
  const tag = node.tag.toLowerCase()
  const fontSize = parsePx(style['font-size']) ?? defaultFontSizeForTag(tag)
  const fontWeight = parseFontWeight(style['font-weight']) ?? defaultFontWeightForTag(tag)
  const fontFamily = style['font-family']?.trim() || ctx.fontFamily
  const color = style.color ?? ctx.color
  const segments = extractTextSegments(node, {
    fontFamily,
    fontSize,
    fontWeight,
    color,
    letterSpacing: parsePx(style['letter-spacing']) ?? 0,
    lineHeightRatio: parseNumber(style['line-height']) ?? 1.2,
  })
  const nowrap = style['white-space'] === 'nowrap'
  const textWrap = style['text-wrap'] === 'wrap' ? 'wrap' : 'balance'
  const authorW = parsePx(style.width)
  const authorH = parsePx(style.height)
  const authorMax = parsePx(style['max-width'])
  const lineHeightRatio = parseNumber(style['line-height']) ?? (segments.length > 1 ? 1.4 : 1.2)

  const appearance = readAppearance(node.attrs, style, ctx)
  const innerPadX = appearance.padding.left + appearance.padding.right + (appearance.border?.width ?? 0) * 2
  const innerPadY = appearance.padding.top + appearance.padding.bottom + (appearance.border?.width ?? 0) * 2

  let maxW: number | undefined
  if (authorW == null) {
    const limit = opts?.contentWidthLimit ?? ctx.maxContentWidth
    maxW = authorMax == null ? limit : Math.min(authorMax, limit)
  }

  const textLayout = layoutText({
    segments,
    fixedWidth: authorW != null ? Math.max(0, authorW - innerPadX) : undefined,
    fixedHeight: authorH != null ? Math.max(0, authorH - innerPadY) : undefined,
    maxWidth: maxW,
    nowrap,
    textWrap,
    lineHeightRatio,
    fontSize,
  })

  let contentW = textLayout.contentWidth
  let contentH = textLayout.contentHeight
  if (authorW != null) contentW = Math.max(contentW, authorW - innerPadX)
  if (authorH != null) contentH = Math.max(contentH, authorH - innerPadY)

  const outer = outerFromContent(contentW, contentH, appearance.padding, appearance.border)
  const ink = translateBox(textLayout.ink, outer.contentOffsetX, outer.contentOffsetY)

  const textAlign = (style['text-align'] ?? 'left').trim() as 'left' | 'center' | 'right'

  if (shouldReport(ctx) && textLayout.overflowFixed) {
    ctx.issues.push({
      level: 'error',
      code: 'text-overflow',
      path: ctx.pathPrefix,
      message: '文字超出写死的 width/height',
    })
  }
  if (shouldReport(ctx) && textLayout.autoWrap) {
    ctx.issues.push({
      level: 'info',
      code: 'auto-wrap',
      path: ctx.pathPrefix,
      message: '文字超出可用宽度，已自动换行',
    })
  }

  return {
    kind: 'text',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: opts?.outerWidth ?? authorW ?? outer.width,
    height: opts?.outerHeight ?? authorH ?? outer.height,
    ink,
    ...appearance,
    textLayout,
    textAlign,
    ...layoutDrawMeta(node, ctx),
  }
}

function layoutShape(node: FvgNode, ctx: LayoutContext, defaultStroke: string): ShapeLayoutNode {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  let w = parsePx(style.width) ?? parseNumber(node.attrs.width) ?? 0
  let h = parsePx(style.height) ?? parseNumber(node.attrs.height) ?? 0
  if (node.tag === 'Circle') {
    const r = parseNumber(node.attrs.r) ?? 0
    w = h = r * 2
  }
  if (node.tag === 'Ellipse') {
    w = (parseNumber(node.attrs.rx) ?? 0) * 2
    h = (parseNumber(node.attrs.ry) ?? 0) * 2
  }
  if (node.tag === 'Rect') {
    w = parseNumber(node.attrs.width) ?? w
    h = parseNumber(node.attrs.height) ?? h
  }
  const fill = node.attrs.fill ?? style.fill ?? '#000000'
  const stroke = node.attrs.stroke ?? style.stroke ?? 'none'
  const strokeWidth = parseNumber(node.attrs['stroke-width']) ?? parsePx(style['stroke-width']) ?? 1
  const ink = { x: 0, y: 0, width: w, height: h }
  return {
    kind: 'shape',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: w,
    height: h,
    ink,
    ...appearance,
    shape: node.tag === 'Rect' ? 'rect' : node.tag === 'Circle' ? 'circle' : 'ellipse',
    fill,
    stroke,
    strokeWidth,
    rx: parseNumber(node.attrs.rx) ?? parsePx(style['border-radius']),
    r: parseNumber(node.attrs.r),
    rxEllipse: parseNumber(node.attrs.rx),
    ry: parseNumber(node.attrs.ry),
    ...layoutDrawMeta(node, ctx),
  }
}

function layoutLineNode(node: FvgNode, ctx: LayoutContext, defaultStroke: string): LineLayoutNode {
  let geom: LineGeometry
  if (node.tag === 'Line' || node.tag === 'Arrow') {
    geom = {
      kind: node.tag === 'Arrow' ? 'arrow' : 'line',
      x1: parseNumber(node.attrs.x1) ?? 0,
      y1: parseNumber(node.attrs.y1) ?? 0,
      x2: parseNumber(node.attrs.x2) ?? 0,
      y2: parseNumber(node.attrs.y2) ?? 0,
      head: parseNumber(node.attrs.head),
    }
  } else if (node.tag === 'Polyline' || node.tag === 'Polygon') {
    const pts = (node.attrs.points ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [xs, ys] = pair.split(',')
        return { x: Number(xs), y: Number(ys) }
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    geom = { kind: node.tag === 'Polygon' ? 'polygon' : 'polyline', points: pts }
  } else {
    geom = { kind: 'path', d: node.attrs.d ?? '' }
  }
  const strokeWidth = parseNumber(node.attrs['stroke-width']) ?? 4
  const stroke = node.attrs.stroke ?? defaultStroke
  const fill = node.attrs.fill ?? 'none'
  const box = lineBounds(geom, strokeWidth)
  const localGeom = normalizeLineGeometry(geom, box)
  return {
    kind: 'line',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    ink: { x: 0, y: 0, width: box.width, height: box.height },
    opacity: parseNumber(node.attrs.opacity) ?? 1,
    rotate: parseNumber(node.attrs.rotate) ?? 0,
    scale: parseNumber(node.attrs.scale) ?? 1,
    padding: ZERO_EDGES,
    geometry: localGeom,
    stroke,
    strokeWidth,
    fill,
    ...layoutDrawMeta(node, ctx),
  }
}

function mapAlignSelf(v: string | undefined): Align | undefined {
  switch ((v ?? '').trim()) {
    case 'start':
      return Align.FlexStart
    case 'center':
      return Align.Center
    case 'end':
      return Align.FlexEnd
    case 'stretch':
      return Align.Stretch
    default:
      return undefined
  }
}

type YogaSession = {
  config: YogaConfig
}

type YogaBuilt = {
  yn: YogaNode
  realize: () => LayoutNode
}

function applyFlexItem(yn: YogaNode, style: Record<string, string>, isText: boolean) {
  const { grow, shrink } = parseFlexGrowShrink(style, isText)
  yn.setFlexGrow(grow)
  yn.setFlexShrink(shrink)
  yn.setFlexBasisAuto()
  const self = mapAlignSelf(style['align-self'])
  if (self != null) yn.setAlignSelf(self)
}

function applyPaddingAndBorder(
  yn: YogaNode,
  appearance: { padding: Edges; border?: { width: number; color: string } },
) {
  yn.setPadding(Edge.Left, appearance.padding.left)
  yn.setPadding(Edge.Top, appearance.padding.top)
  yn.setPadding(Edge.Right, appearance.padding.right)
  yn.setPadding(Edge.Bottom, appearance.padding.bottom)
  const bw = appearance.border?.width ?? 0
  if (bw > 0) {
    yn.setBorder(Edge.Left, bw)
    yn.setBorder(Edge.Top, bw)
    yn.setBorder(Edge.Right, bw)
    yn.setBorder(Edge.Bottom, bw)
  }
}

function horizontalChrome(appearance: { padding: Edges; border?: { width: number } }): number {
  return appearance.padding.left + appearance.padding.right + (appearance.border?.width ?? 0) * 2
}

function explicitShapeSize(node: FvgNode): { width?: number; height?: number } {
  const style = parseStyle(node.attrs.style)
  if (node.tag === 'Circle') {
    const d = (parseNumber(node.attrs.r) ?? 0) * 2
    return { width: d, height: d }
  }
  if (node.tag === 'Ellipse') {
    return {
      width: (parseNumber(node.attrs.rx) ?? 0) * 2,
      height: (parseNumber(node.attrs.ry) ?? 0) * 2,
    }
  }
  return {
    width: parseNumber(node.attrs.width) ?? parsePx(style.width),
    height: parseNumber(node.attrs.height) ?? parsePx(style.height),
  }
}

function buildText(session: YogaSession, node: FvgNode, ctx: LayoutContext): YogaBuilt {
  const Yoga = getYoga()
  const style = parseStyle(node.attrs.style)
  const tag = node.tag.toLowerCase()
  const fontSize = parsePx(style['font-size']) ?? defaultFontSizeForTag(tag)
  const fontWeight = parseFontWeight(style['font-weight']) ?? defaultFontWeightForTag(tag)
  const fontFamily = style['font-family']?.trim() || ctx.fontFamily
  const color = style.color ?? ctx.color
  const segments = extractTextSegments(node, {
    fontFamily,
    fontSize,
    fontWeight,
    color,
    letterSpacing: parsePx(style['letter-spacing']) ?? 0,
    lineHeightRatio: parseNumber(style['line-height']) ?? 1.2,
  })
  const nowrap = style['white-space'] === 'nowrap'
  const textWrap = style['text-wrap'] === 'wrap' ? 'wrap' : 'balance'
  const lineHeightRatio = parseNumber(style['line-height']) ?? (segments.length > 1 ? 1.4 : 1.2)
  const appearance = readAppearance(node.attrs, style, ctx)
  const authorW = parsePx(style.width)
  const authorH = parsePx(style.height)
  const authorMax = parsePx(style['max-width'])
  const minContent = layoutText({
    segments,
    nowrap: true,
    textWrap,
    lineHeightRatio,
    fontSize,
  }).minWidth

  const yn = Yoga.Node.create(session.config)
  applyFlexItem(yn, style, true)
  applyPaddingAndBorder(yn, appearance)
  yn.setMinWidth(minContent + horizontalChrome(appearance))
  if (authorW != null) yn.setWidth(authorW)
  if (authorH != null) yn.setHeight(authorH)
  if (authorMax != null) yn.setMaxWidth(authorMax)
  yn.setMeasureFunc((width, widthMode, height, heightMode) => {
    const fixedWidth = widthMode === MeasureMode.Exactly ? Math.max(0, width) : undefined
    const maxWidth = widthMode === MeasureMode.AtMost ? Math.max(0, width) : undefined
    const fixedHeight = heightMode === MeasureMode.Exactly ? Math.max(0, height) : undefined
    const laid = layoutText({
      segments,
      fixedWidth,
      fixedHeight,
      maxWidth: fixedWidth != null ? undefined : maxWidth,
      nowrap,
      textWrap,
      lineHeightRatio,
      fontSize,
    })
    return {
      width: fixedWidth ?? laid.contentWidth,
      height: fixedHeight ?? laid.contentHeight,
    }
  })

  return {
    yn,
    realize() {
      const layout = yn.getComputedLayout()
      const bw = appearance.border?.width ?? 0
      const contentW = Math.max(0, layout.width - horizontalChrome(appearance))
      const box = layoutTextBox(node, ctx, {
        contentWidthLimit: contentW,
        outerWidth: layout.width,
        outerHeight: layout.height,
      })
      box.x = layout.left
      box.y = layout.top
      return box
    },
  }
}

function buildShape(session: YogaSession, node: FvgNode, ctx: LayoutContext): YogaBuilt {
  const Yoga = getYoga()
  const style = parseStyle(node.attrs.style)
  const size = explicitShapeSize(node)
  const yn = Yoga.Node.create(session.config)
  applyFlexItem(yn, style, false)
  if (size.width != null) yn.setWidth(size.width)
  if (size.height != null) yn.setHeight(size.height)
  const maxW = parsePx(style['max-width'])
  if (maxW != null) yn.setMaxWidth(maxW)
  return {
    yn,
    realize() {
      const layout = yn.getComputedLayout()
      const shape = layoutShape(node, ctx, ctx.color)
      return {
        ...shape,
        x: layout.left,
        y: layout.top,
        width: layout.width,
        height: layout.height,
        ink: { x: 0, y: 0, width: layout.width, height: layout.height },
      }
    },
  }
}

function buildCustom(session: YogaSession, node: FvgNode, ctx: LayoutContext, custom: CustomLayoutNode): YogaBuilt {
  const Yoga = getYoga()
  const style = parseStyle(node.attrs.style)
  const yn = Yoga.Node.create(session.config)
  applyFlexItem(yn, style, false)
  yn.setWidth(custom.width)
  yn.setHeight(custom.height)
  return {
    yn,
    realize() {
      const layout = yn.getComputedLayout()
      return { ...custom, x: layout.left, y: layout.top, width: layout.width, height: layout.height }
    },
  }
}

function buildLayer(session: YogaSession, node: FvgNode, ctx: LayoutContext): YogaBuilt {
  const Yoga = getYoga()
  const style = parseStyle(node.attrs.style)
  const authorW = parsePx(style.width) ?? parseNumber(node.attrs.width)
  const authorH = parsePx(style.height) ?? parseNumber(node.attrs.height)
  const yn = Yoga.Node.create(session.config)
  applyFlexItem(yn, style, false)
  if (authorW != null) yn.setWidth(authorW)
  if (authorH != null) yn.setHeight(authorH)
  yn.setMeasureFunc((width, widthMode, height, heightMode) => {
    const silent: LayoutContext = { ...ctx, reportIssues: false }
    const constraint: { width?: number; height?: number } = {}
    if (widthMode === MeasureMode.Exactly) constraint.width = Math.max(0, width)
    else if (widthMode === MeasureMode.AtMost) {
      silent.maxContentWidth = Math.min(ctx.maxContentWidth, Math.max(0, width))
    }
    if (heightMode === MeasureMode.Exactly) constraint.height = Math.max(0, height)
    const laid = layoutLayer(node, silent, constraint)
    return { width: laid.width, height: laid.height }
  })
  return {
    yn,
    realize() {
      const layout = yn.getComputedLayout()
      const laid = layoutLayer(
        node,
        { ...ctx, maxContentWidth: Math.min(ctx.maxContentWidth, layout.width) },
        { width: layout.width, height: layout.height },
      )
      laid.x = layout.left
      laid.y = layout.top
      laid.width = layout.width
      laid.height = layout.height
      return laid
    },
  }
}

function buildFlexChild(session: YogaSession, node: FvgNode, ctx: LayoutContext): YogaBuilt | null {
  if (isLineTag(node.tag)) {
    if (shouldReport(ctx)) {
      ctx.issues.push({ level: 'warn', code: 'invalid-child', path: ctx.pathPrefix, message: '线条不能放在 Row/Column 内' })
    }
    return null
  }
  if (isTextBoxTag(node.tag)) return buildText(session, node, ctx)
  if (isShapeTag(node.tag)) return buildShape(session, node, ctx)
  if (isFlexTag(node.tag)) return buildFlex(session, node, ctx, false)
  if (ROOT_TAGS.has(node.tag) || node.tag === 'Layer') return buildLayer(session, node, ctx)
  const custom = layoutCustomDraw(node, ctx)
  if (custom) return buildCustom(session, node, ctx, custom)
  if (shouldReport(ctx)) {
    ctx.issues.push({ level: 'warn', code: 'unknown-tag', path: ctx.pathPrefix, message: `未知标签 ${node.tag}` })
  }
  return null
}

function resolveFlexMaxWidth(styleMax: number | undefined, cap: number | undefined): number | undefined {
  if (styleMax == null) return cap
  if (cap == null) return styleMax
  return Math.min(styleMax, cap)
}

function buildFlex(session: YogaSession, node: FvgNode, ctx: LayoutContext, applyLayerCap: boolean): YogaBuilt {
  const Yoga = getYoga()
  const direction = node.tag === 'Row' ? 'row' : 'column'
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const gap = parsePx(style.gap) ?? 0
  const authorW = parsePx(style.width)
  const authorH = parsePx(style.height)
  const authorMax = parsePx(style['max-width'])

  const yn = Yoga.Node.create(session.config)
  yn.setFlexDirection(direction === 'row' ? FlexDirection.Row : FlexDirection.Column)
  yn.setJustifyContent(mapJustify(style['justify-content']))
  yn.setAlignItems(mapAlign(style['align-items']))
  if (gap > 0) yn.setGap(direction === 'row' ? Gutter.Column : Gutter.Row, gap)
  applyFlexItem(yn, style, false)
  applyPaddingAndBorder(yn, appearance)
  if (authorW != null) yn.setWidth(authorW)
  if (authorH != null) yn.setHeight(authorH)
  const cap = applyLayerCap ? ctx.maxContentWidth : undefined
  const maxW = authorW == null ? resolveFlexMaxWidth(authorMax, cap) : authorMax
  if (maxW != null && Number.isFinite(maxW)) yn.setMaxWidth(Math.max(0, maxW))

  const items: YogaBuilt[] = []
  const childNodes = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  for (let i = 0; i < childNodes.length; i++) {
    const ch = childNodes[i]!
    const built = buildFlexChild(session, ch, { ...ctx, pathPrefix: nodePath(ctx.pathPrefix, ch.tag, i) })
    if (!built) continue
    yn.insertChild(built.yn, items.length)
    items.push(built)
  }

  return {
    yn,
    realize() {
      const layout = yn.getComputedLayout()
      const children = items.map((item) => item.realize())
      let ink = emptyBox()
      let hasInk = false
      for (const ch of children) {
        const box = translateBox(ch.ink, ch.x, ch.y)
        ink = hasInk ? unionBoxes(ink, box) : box
        hasInk = true
      }
      const bw = appearance.border?.width ?? 0
      const innerLeft = appearance.padding.left + bw
      const innerTop = appearance.padding.top + bw
      const innerRight = layout.width - appearance.padding.right - bw
      const innerBottom = layout.height - appearance.padding.bottom - bw
      let overflowX = false
      let overflowY = false
      for (const ch of children) {
        if (ch.x < innerLeft - 0.5 || ch.x + ch.width > innerRight + 0.5) overflowX = true
        if (ch.y < innerTop - 0.5 || ch.y + ch.height > innerBottom + 0.5) overflowY = true
      }
      if (shouldReport(ctx) && overflowX) {
        ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 width' })
      }
      if (shouldReport(ctx) && overflowY) {
        ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 height' })
      }
      const laid: FlexLayoutNode = {
        kind: 'flex',
        path: ctx.pathPrefix,
        id: node.attrs.id,
        tag: node.tag,
        x: layout.left,
        y: layout.top,
        width: layout.width,
        height: layout.height,
        ink,
        ...appearance,
        direction,
        children,
        ...layoutDrawMeta(node, ctx),
      }
      return laid
    },
  }
}

function layoutFlex(node: FvgNode, ctx: LayoutContext): FlexLayoutNode {
  const yoga = getYoga()
  const config = yoga.Config.create()
  config.setUseWebDefaults(true)
  const built = buildFlex({ config }, node, ctx, true)
  built.yn.calculateLayout(undefined, undefined)
  try {
    return built.realize() as FlexLayoutNode
  } finally {
    built.yn.freeRecursive()
    config.free()
  }
}

function layoutLayer(
  node: FvgNode,
  ctx: LayoutContext,
  constraint?: { width?: number; height?: number },
): LayerLayoutNode {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const styleW = parsePx(style.width) ?? parseNumber(node.attrs.width)
  const styleH = parsePx(style.height) ?? parseNumber(node.attrs.height)
  const fixedW = constraint?.width ?? styleW
  const fixedH = constraint?.height ?? styleH
  const isRoot = ctx.pathPrefix === 'fvg'
  const childCap = !isRoot && fixedW != null && fixedW > 0 ? fixedW : ctx.maxContentWidth

  const childFvg = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const placed: Array<{ child: LayoutNode; cx?: number; cy?: number; anchor: Anchor; useDefaultCenter: boolean }> = []

  for (let i = 0; i < childFvg.length; i++) {
    const ch = childFvg[i]!
    const path = nodePath(ctx.pathPrefix, ch.tag, i)
    const subCtx = { ...ctx, pathPrefix: path, maxContentWidth: childCap }
    let laid: LayoutNode | null = null
    if (isLineTag(ch.tag)) laid = layoutLineNode(ch, subCtx, ctx.color)
    else if (isTextBoxTag(ch.tag)) laid = layoutTextBox(ch, subCtx)
    else if (isShapeTag(ch.tag)) laid = layoutShape(ch, subCtx, ctx.color)
    else if (isFlexTag(ch.tag)) laid = layoutFlex(ch, subCtx)
    else if (ROOT_TAGS.has(ch.tag) || ch.tag === 'Layer') laid = layoutLayer(ch, subCtx)
    else {
      laid = layoutUnknownOrCustom(ch, subCtx)
      if (!laid) continue
    }
    const cx = parseNumber(ch.attrs.cx)
    const cy = parseNumber(ch.attrs.cy)
    placed.push({
      child: laid,
      cx: cx ?? undefined,
      cy: cy ?? undefined,
      anchor: parseAnchor(ch.attrs.anchor),
      useDefaultCenter: cx == null || cy == null,
    })
  }

  let layerW = fixedW ?? 0
  let layerH = fixedH ?? 0

  const positionOne = (p: (typeof placed)[0], lw: number, lh: number) => {
    const cx = p.cx ?? lw / 2
    const cy = p.cy ?? lh / 2
    const tl = anchorTopLeft(cx, cy, p.child.width, p.child.height, p.anchor)
    p.child.x = tl.x
    p.child.y = tl.y
  }

  if (layerW > 0 && layerH > 0) {
    for (const p of placed) positionOne(p, layerW, layerH)
  } else {
    for (const p of placed) positionOne(p, 0, 0)
    let union = emptyBox()
    for (const p of placed) {
      union = unionBoxes(union, { x: p.child.x, y: p.child.y, width: p.child.width, height: p.child.height })
    }
    layerW = fixedW ?? Math.max(union.width, 0)
    layerH = fixedH ?? Math.max(union.height, 0)
    for (const p of placed) {
      if (p.useDefaultCenter) {
        p.cx = layerW / 2
        p.cy = layerH / 2
      }
      positionOne(p, layerW, layerH)
    }
    union = emptyBox()
    for (const p of placed) {
      union = unionBoxes(union, { x: p.child.x, y: p.child.y, width: p.child.width, height: p.child.height })
    }
    const dx = union.x < 0 ? -union.x : 0
    const dy = union.y < 0 ? -union.y : 0
    if (dx || dy) {
      for (const p of placed) {
        p.child.x += dx
        p.child.y += dy
      }
    }
    if (!fixedW) layerW = union.width + dx
    if (!fixedH) layerH = union.height + dy
  }

  let ink = emptyBox()
  const children = placed.map((p) => {
    ink = unionBoxes(ink, translateBox(p.child.ink, p.child.x, p.child.y))
    return p.child
  })

  return {
    kind: 'layer',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: layerW,
    height: layerH,
    ink,
    ...appearance,
    children,
    ...layoutDrawMeta(node, ctx),
  }
}

export async function layoutSource(source: string | FvgNode, baseDir: string): Promise<FvgDocument> {
  const nodes = typeof source === 'string' ? parseFvg(source) : [source]
  const fontNodes: Array<{ family: string; src: string }> = []
  let rootNode: FvgNode | null = null
  for (const n of nodes) {
    if (n.tag === FONT_TAG) {
      fontNodes.push({ family: n.attrs.family ?? '', src: n.attrs.src ?? '' })
    } else if (!rootNode) {
      rootNode = n
    }
  }
  if (!rootNode) throw new Error('FVG 缺少根元素 <fvg> 或 <Layer>')
  await registerFontsFromDocument(fontNodes.filter((f) => f.family && f.src), baseDir)

  const attrs = rootNode.attrs
  const style = parseStyle(attrs.style)
  const width = parseNumber(attrs.width) ?? parsePx(style.width) ?? 1080
  const height = parseNumber(attrs.height) ?? parsePx(style.height) ?? 1920
  const background = attrs.background ?? style.background ?? '#ffffff'
  const color = attrs.color ?? style.color ?? '#111111'
  const fontFamily = attrs['font-family'] ?? style['font-family'] ?? 'ChillDuanSans'
  const safe = parseSafe(attrs.safe, width, height)
  const maxContentWidth = width - safe.left - safe.right

  const issues: Issue[] = []
  await ensureYoga()
  const root = layoutLayer(
    rootNode.tag.toLowerCase() === 'fvg' ? { ...rootNode, tag: 'Layer' } : rootNode,
    {
      color,
      fontFamily,
      maxContentWidth,
      issues,
      pathPrefix: 'fvg',
    },
  )

  root.width = width
  root.height = height

  return { width, height, background, color, fontFamily, safe, root, issues }
}

export type { FvgDocument }

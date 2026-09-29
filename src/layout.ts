import { Path2D } from '@napi-rs/canvas'
import {
  Align,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
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
import { layoutMath } from './math/lower.js'
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
import { ensureYoga } from './yoga.js'

export type LayoutContext = {
  color: string
  fontFamily: string
  maxContentWidth: number
  issues: Issue[]
  pathPrefix: string
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

function warnMathInText(node: FvgNode, ctx: LayoutContext) {
  const visit = (n: FvgNode) => {
    for (const c of n.children) {
      if (typeof c === 'string') continue
      if (c.tag === 'math') {
        ctx.issues.push({
          level: 'warn',
          code: 'invalid-child',
          path: ctx.pathPrefix,
          message: '文字盒子里不能放 math',
        })
      }
      visit(c)
    }
  }
  visit(node)
}

function layoutTextBox(node: FvgNode, ctx: LayoutContext, contentWidthLimit?: number): TextLayoutNode {
  warnMathInText(node, ctx)
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
    lineHeightRatio: parseNumber(style['line-height']) ?? (1.2),
  })
  const nowrap = style['white-space'] === 'nowrap'
  const textWrap = style['text-wrap'] === 'wrap' ? 'wrap' : 'balance'
  const fixedW = parsePx(style.width)
  const fixedH = parsePx(style.height)
  const maxW = parsePx(style['max-width']) ?? contentWidthLimit
  const lineHeightRatio = parseNumber(style['line-height']) ?? (segments.length > 1 ? 1.4 : 1.2)

  const appearance = readAppearance(node.attrs, style, ctx)
  const innerPadX = appearance.padding.left + appearance.padding.right + (appearance.border?.width ?? 0) * 2
  const innerPadY = appearance.padding.top + appearance.padding.bottom + (appearance.border?.width ?? 0) * 2

  const textLayout = layoutText({
    segments,
    fixedWidth: fixedW != null ? Math.max(0, fixedW - innerPadX) : undefined,
    fixedHeight: fixedH != null ? Math.max(0, fixedH - innerPadY) : undefined,
    maxWidth: maxW,
    nowrap,
    textWrap,
    lineHeightRatio,
    fontSize,
  })

  let contentW = textLayout.contentWidth
  let contentH = textLayout.contentHeight
  if (fixedW != null) contentW = Math.max(contentW, fixedW - appearance.padding.left - appearance.padding.right - (appearance.border?.width ?? 0) * 2)
  if (fixedH != null) contentH = Math.max(contentH, fixedH - appearance.padding.top - appearance.padding.bottom - (appearance.border?.width ?? 0) * 2)

  const outer = outerFromContent(contentW, contentH, appearance.padding, appearance.border)
  const ink = translateBox(textLayout.ink, outer.contentOffsetX, outer.contentOffsetY)

  const textAlign = (style['text-align'] ?? 'left').trim() as 'left' | 'center' | 'right'

  if (textLayout.overflowFixed) {
    ctx.issues.push({
      level: 'error',
      code: 'text-overflow',
      path: ctx.pathPrefix,
      message: '文字超出写死的 width/height',
    })
  }
  if (textLayout.autoWrap) {
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
    width: fixedW ?? outer.width,
    height: fixedH ?? outer.height,
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

type FlexMeasure = {
  node: LayoutNode
  minMain: number
  minCross: number
  preferredMain: number
  preferredCross: number
  isText: boolean
}

async function measureFlexChild(node: FvgNode, ctx: LayoutContext, direction: 'row' | 'column'): Promise<FlexMeasure | null> {
  if (isLineTag(node.tag)) {
    ctx.issues.push({ level: 'warn', code: 'invalid-child', path: ctx.pathPrefix, message: '线条不能放在 Row/Column 内' })
    return null
  }
  if (isTextBoxTag(node.tag)) {
    const laid = layoutTextBox(node, ctx, ctx.maxContentWidth)
    return {
      node: laid,
      minMain: direction === 'row' ? laid.textLayout.minWidth : laid.height,
      minCross: direction === 'row' ? laid.height : laid.textLayout.minWidth,
      preferredMain: direction === 'row' ? laid.width : laid.height,
      preferredCross: direction === 'row' ? laid.height : laid.width,
      isText: true,
    }
  }
  if (isShapeTag(node.tag)) {
    const s = layoutShape(node, ctx, ctx.color)
    return {
      node: s,
      minMain: direction === 'row' ? s.width : s.height,
      minCross: direction === 'row' ? s.height : s.width,
      preferredMain: direction === 'row' ? s.width : s.height,
      preferredCross: direction === 'row' ? s.height : s.width,
      isText: false,
    }
  }
  if (isFlexTag(node.tag)) {
    const nested = await layoutFlex(node, ctx)
    return {
      node: nested,
      minMain: direction === 'row' ? nested.width : nested.height,
      minCross: direction === 'row' ? nested.height : nested.width,
      preferredMain: direction === 'row' ? nested.width : nested.height,
      preferredCross: direction === 'row' ? nested.height : nested.width,
      isText: false,
    }
  }
  if (ROOT_TAGS.has(node.tag) || node.tag === 'Layer') {
    const nested = await layoutLayer(node, ctx)
    return {
      node: nested,
      minMain: direction === 'row' ? nested.width : nested.height,
      minCross: direction === 'row' ? nested.height : nested.width,
      preferredMain: direction === 'row' ? nested.width : nested.height,
      preferredCross: direction === 'row' ? nested.height : nested.width,
      isText: false,
    }
  }
  if (node.tag === 'math') {
    const laid = layoutMath(node, ctx)
    return {
      node: laid,
      minMain: direction === 'row' ? laid.width : laid.height,
      minCross: direction === 'row' ? laid.height : laid.width,
      preferredMain: direction === 'row' ? laid.width : laid.height,
      preferredCross: direction === 'row' ? laid.height : laid.width,
      isText: false,
    }
  }
  const custom = layoutCustomDraw(node, ctx)
  if (custom) {
    return {
      node: custom,
      minMain: direction === 'row' ? custom.width : custom.height,
      minCross: direction === 'row' ? custom.height : custom.width,
      preferredMain: direction === 'row' ? custom.width : custom.height,
      preferredCross: direction === 'row' ? custom.height : custom.width,
      isText: false,
    }
  }
  ctx.issues.push({ level: 'warn', code: 'unknown-tag', path: ctx.pathPrefix, message: `未知标签 ${node.tag}` })
  return null
}

async function layoutFlex(node: FvgNode, ctx: LayoutContext): Promise<FlexLayoutNode> {
  const direction = node.tag === 'Row' ? 'row' : 'column'
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const gap = parsePx(style.gap) ?? 0
  const justify = mapJustify(style['justify-content'])
  const alignItems = mapAlign(style['align-items'])

  const fixedW = parsePx(style.width)
  const fixedH = parsePx(style.height)
  const childNodes = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const measures: FlexMeasure[] = []
  for (let i = 0; i < childNodes.length; i++) {
    const ch = childNodes[i]!
    const m = await measureFlexChild(ch, { ...ctx, pathPrefix: nodePath(ctx.pathPrefix, ch.tag, i) }, direction)
    if (m) measures.push(m)
  }

  let crossAvailable =
    direction === 'row'
      ? fixedH != null
        ? fixedH - appearance.padding.top - appearance.padding.bottom - (appearance.border?.width ?? 0) * 2
        : Math.max(0, ...measures.map((m) => m.preferredCross))
      : fixedW != null
        ? fixedW - appearance.padding.left - appearance.padding.right - (appearance.border?.width ?? 0) * 2
        : ctx.maxContentWidth

  const Yoga = await ensureYoga()
  const config = Yoga.Config.create()
  config.setUseWebDefaults(true)
  const root = Yoga.Node.createWithConfig(config)
  root.setFlexDirection(direction === 'row' ? FlexDirection.Row : FlexDirection.Column)
  root.setJustifyContent(justify)
  root.setAlignItems(alignItems)
  if (gap > 0) root.setGap(direction === 'row' ? Gutter.Column : Gutter.Row, gap)

  const mainAvailable =
    direction === 'row'
      ? fixedW != null
        ? fixedW - appearance.padding.left - appearance.padding.right - (appearance.border?.width ?? 0) * 2
        : ctx.maxContentWidth
      : fixedH ?? 1e6

  if (direction === 'row') {
    root.setWidth(Math.max(0, mainAvailable))
    root.setHeight(Math.max(0, crossAvailable === Infinity ? 0 : crossAvailable))
  } else {
    root.setWidth(Math.max(0, crossAvailable))
    root.setHeight(Math.max(0, mainAvailable))
  }

  const yogaChildren: YogaNode[] = []
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!
    const childFvg = childNodes[i]!
    const chParsed = parseStyle(childFvg.attrs.style)
    const { grow, shrink } = parseFlexGrowShrink(chParsed, m.isText)
    const yn = Yoga.Node.create()
    yn.setFlexGrow(grow)
    yn.setFlexShrink(shrink)
    yn.setFlexBasisAuto()
    if (direction === 'row') {
      yn.setWidth(m.preferredMain)
      yn.setHeight(m.preferredCross === Infinity ? m.preferredCross : m.preferredCross)
      yn.setMinWidth(m.minMain)
    } else {
      yn.setWidth(m.preferredCross === Infinity ? crossAvailable : m.preferredCross)
      yn.setHeight(m.preferredMain)
      yn.setMinWidth(m.isText ? m.minMain : 0)
    }
    yogaChildren.push(yn)
    root.insertChild(yn, yogaChildren.length - 1)
  }

  root.calculateLayout(undefined, undefined)

  const laidChildren: LayoutNode[] = []
  let contentW = 0
  let contentH = 0
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!
    const yn = yogaChildren[i]!
    const layout = yn.getComputedLayout()
    let child = m.node
    if (m.isText && child.kind === 'text') {
      const assignedW =
        direction === 'column'
          ? layout.width
          : layout.width
      const styleCh = parseStyle(childNodes[i]!.attrs.style)
      const innerW = assignedW - child.padding.left - child.padding.right - (child.border?.width ?? 0) * 2
      const re = layoutTextBox(childNodes[i]!, { ...ctx, pathPrefix: child.path }, innerW)
      re.x = layout.left
      re.y = layout.top
      child = re
    } else {
      child = { ...child, x: layout.left, y: layout.top, width: layout.width, height: layout.height }
      if (child.kind === 'layer' || child.kind === 'flex') {
        // keep internal layout; stretch box only
      }
    }
    laidChildren.push(child)
    contentW = Math.max(contentW, layout.left + layout.width)
    contentH = Math.max(contentH, layout.top + layout.height)
  }

  for (const yn of yogaChildren) yn.free()
  root.freeRecursive()
  config.free()

  const outer = outerFromContent(contentW, contentH, appearance.padding, appearance.border)
  if (fixedW != null && outer.width > fixedW + 1e-3) {
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 width' })
  }
  if (fixedH != null && outer.height > fixedH + 1e-3) {
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 height' })
  }

  return {
    kind: 'flex',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: fixedW ?? outer.width,
    height: fixedH ?? outer.height,
    ink: { x: appearance.padding.left, y: appearance.padding.top, width: contentW, height: contentH },
    ...appearance,
    direction,
    children: laidChildren,
    ...layoutDrawMeta(node, ctx),
  }
}

async function layoutLayer(node: FvgNode, ctx: LayoutContext): Promise<LayerLayoutNode> {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const fixedW = parsePx(style.width) ?? parseNumber(node.attrs.width)
  const fixedH = parsePx(style.height) ?? parseNumber(node.attrs.height)

  const childFvg = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const placed: Array<{ child: LayoutNode; cx?: number; cy?: number; anchor: Anchor; useDefaultCenter: boolean }> = []

  for (let i = 0; i < childFvg.length; i++) {
    const ch = childFvg[i]!
    const path = nodePath(ctx.pathPrefix, ch.tag, i)
    const subCtx = { ...ctx, pathPrefix: path }
    let laid: LayoutNode | null = null
    if (isLineTag(ch.tag)) laid = layoutLineNode(ch, subCtx, ctx.color)
    else if (isTextBoxTag(ch.tag)) laid = layoutTextBox(ch, subCtx, ctx.maxContentWidth)
    else if (isShapeTag(ch.tag)) laid = layoutShape(ch, subCtx, ctx.color)
    else if (isFlexTag(ch.tag)) laid = await layoutFlex(ch, subCtx)
    else if (ROOT_TAGS.has(ch.tag) || ch.tag === 'Layer') laid = await layoutLayer(ch, subCtx)
    else if (ch.tag === 'math') laid = layoutMath(ch, subCtx)
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
  const root = await layoutLayer(
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

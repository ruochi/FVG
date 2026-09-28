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
  parseAngle,
  parseBorder,
  parseDashArray,
  parseEdges,
  parseFontWeight,
  parseGlow,
  parseNumber,
  parsePx,
  parseShadow,
  parseStyle,
  ZERO_EDGES,
  type Edges,
  type StyleMap,
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
  FlexLayoutNode,
  FvgDocument,
  GlowSpec,
  Issue,
  LayerLayoutNode,
  LayoutNode,
  LineCap,
  LineGeometry,
  LineJoin,
  LineLayoutNode,
  ShadowSpec,
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
  /** 父容器的摆放方式；根元素没有父容器 */
  parent?: 'layer' | 'flex'
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

const DEFAULT_SHADOW_COLOR = '#00000066'

const POSITION_ATTRS = ['cx', 'cy', 'anchor'] as const

const EFFECT_KEYS = ['opacity', 'rotate', 'scale', 'shadow', 'glow']
const BOX_KEYS = ['background', 'background-color', 'border', 'border-radius']
const FLEX_CHILD_KEYS = ['flex', 'flex-grow', 'flex-shrink', 'align-self']

type StyleKind = 'text' | 'flex' | 'layer' | 'shape' | 'line' | 'root'

const STYLE_KEYS: Record<StyleKind, string[]> = {
  text: [
    ...EFFECT_KEYS,
    ...BOX_KEYS,
    'width',
    'height',
    'max-width',
    'padding',
    'font-size',
    'font-weight',
    'font-family',
    'color',
    'letter-spacing',
    'line-height',
    'text-align',
    'white-space',
    'text-wrap',
  ],
  flex: [...EFFECT_KEYS, ...BOX_KEYS, 'width', 'height', 'padding', 'gap', 'align-items', 'justify-content'],
  layer: [...EFFECT_KEYS, ...BOX_KEYS, 'width', 'height'],
  shape: [...EFFECT_KEYS, 'width', 'height', 'r', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'border-radius'],
  line: [...EFFECT_KEYS, 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill', 'head'],
  root: ['width', 'height', 'background', 'color', 'font-family', 'safe'],
}

function pushIssue(ctx: LayoutContext, issue: Issue): void {
  if (ctx.issues.some((i) => i.code === issue.code && i.path === issue.path && i.message === issue.message)) return
  ctx.issues.push(issue)
}

/** 先读 style；只写在标签上的旧写法照读，并提示改写进 style */
function readProp(node: FvgNode, style: StyleMap, key: string, ctx: LayoutContext): string | undefined {
  const value = style[key]
  if (value != null) return value
  const legacy = node.attrs[key]
  if (legacy == null) return undefined
  pushIssue(ctx, {
    level: 'warn',
    code: 'legacy-attr',
    path: ctx.pathPrefix,
    message: `${key} 请写进 style：style="${key}:${legacy}"`,
  })
  return legacy
}

function checkStyleKeys(node: FvgNode, style: StyleMap, kind: StyleKind, ctx: LayoutContext): void {
  const allowed = new Set(STYLE_KEYS[kind])
  if (ctx.parent === 'flex') for (const key of FLEX_CHILD_KEYS) allowed.add(key)
  for (const key of Object.keys(style)) {
    if (allowed.has(key)) continue
    pushIssue(ctx, { level: 'warn', code: 'unused-style', path: ctx.pathPrefix, message: `style 里的 ${key} 对 ${node.tag} 无效` })
  }
}

function readBox(style: StyleMap) {
  return {
    padding: parseEdges(style.padding) ?? ZERO_EDGES,
    border: parseBorder(style.border),
    borderRadius: parsePx(style['border-radius']) ?? 0,
    background: style.background ?? style['background-color'],
  }
}

function readEffects(node: FvgNode, style: StyleMap, ctx: LayoutContext, glowColor: string) {
  let shadow: ShadowSpec | undefined
  const shadowRaw = readProp(node, style, 'shadow', ctx)
  const shadowValue = parseShadow(shadowRaw)
  if (shadowValue) shadow = { ...shadowValue, color: shadowValue.color ?? DEFAULT_SHADOW_COLOR }
  else if (shadowRaw && shadowRaw.trim() !== 'none') {
    pushIssue(ctx, { level: 'warn', code: 'invalid-attr', path: ctx.pathPrefix, message: `无法解析 shadow: ${shadowRaw}` })
  }

  let glow: GlowSpec | undefined
  const glowRaw = readProp(node, style, 'glow', ctx)
  const glowValue = parseGlow(glowRaw)
  if (glowValue) glow = { ...glowValue, color: glowValue.color ?? glowColor }
  else if (glowRaw && glowRaw.trim() !== 'none') {
    pushIssue(ctx, { level: 'warn', code: 'invalid-attr', path: ctx.pathPrefix, message: `无法解析 glow: ${glowRaw}` })
  }

  return {
    opacity: parseNumber(readProp(node, style, 'opacity', ctx)) ?? 1,
    rotate: parseAngle(readProp(node, style, 'rotate', ctx)) ?? 0,
    scale: parseNumber(readProp(node, style, 'scale', ctx)) ?? 1,
    shadow,
    glow,
  }
}

/** 盒子类元素（文字、容器）：光晕默认取背景色，其次边框色，再次全局色 */
function readAppearance(node: FvgNode, style: StyleMap, ctx: LayoutContext, glowColor?: string) {
  const box = readBox(style)
  const visibleBackground = box.background && box.background !== 'transparent' ? box.background : undefined
  const effects = readEffects(node, style, ctx, glowColor ?? visibleBackground ?? box.border?.color ?? ctx.color)
  return { ...box, ...effects }
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
  if (geom.kind === 'path') return { ...geom, offsetX: -ox, offsetY: -oy }
  return geom
}

function layoutTextBox(node: FvgNode, ctx: LayoutContext, contentWidthLimit?: number): TextLayoutNode {
  const style = parseStyle(node.attrs.style)
  checkStyleKeys(node, style, 'text', ctx)
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

  const appearance = readAppearance(node, style, ctx, color)
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
    pushIssue(ctx, {
      level: 'error',
      code: 'text-overflow',
      path: ctx.pathPrefix,
      message: '文字超出写死的 width/height',
    })
  }
  if (textLayout.autoWrap) {
    pushIssue(ctx, {
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
    line: node.line,
    x: 0,
    y: 0,
    width: fixedW ?? outer.width,
    height: fixedH ?? outer.height,
    ink,
    ...appearance,
    textLayout,
    textAlign,
  }
}

function layoutShape(node: FvgNode, ctx: LayoutContext): ShapeLayoutNode {
  const style = parseStyle(node.attrs.style)
  checkStyleKeys(node, style, 'shape', ctx)
  const length = (key: string) => parsePx(readProp(node, style, key, ctx))
  let w = 0
  let h = 0
  let r: number | undefined
  let rx: number | undefined
  let ry: number | undefined
  if (node.tag === 'circle') {
    r = length('r') ?? 0
    w = h = r * 2
  } else if (node.tag === 'ellipse') {
    rx = length('rx') ?? 0
    ry = length('ry') ?? 0
    w = rx * 2
    h = ry * 2
  } else {
    w = length('width') ?? 0
    h = length('height') ?? 0
    rx = length('rx') ?? parsePx(style['border-radius'])
  }
  const fill = readProp(node, style, 'fill', ctx) ?? '#000000'
  const stroke = readProp(node, style, 'stroke', ctx) ?? 'none'
  const strokeWidth = length('stroke-width') ?? 1
  const dash = parseDashArray(readProp(node, style, 'stroke-dasharray', ctx))
  const effects = readEffects(node, style, ctx, fill !== 'none' ? fill : stroke)
  const ink = { x: 0, y: 0, width: w, height: h }
  return {
    kind: 'shape',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    line: node.line,
    x: 0,
    y: 0,
    width: w,
    height: h,
    ink,
    padding: ZERO_EDGES,
    ...effects,
    shape: node.tag === 'rect' ? 'rect' : node.tag === 'circle' ? 'circle' : 'ellipse',
    fill,
    stroke,
    strokeWidth,
    dash,
    rx: node.tag === 'rect' ? rx : undefined,
    r,
    rxEllipse: node.tag === 'ellipse' ? rx : undefined,
    ry,
  }
}

const LINE_CAPS = new Set(['butt', 'round', 'square'])
const LINE_JOINS = new Set(['miter', 'round', 'bevel'])

function layoutLineNode(node: FvgNode, ctx: LayoutContext, defaultStroke: string): LineLayoutNode {
  const style = parseStyle(node.attrs.style)
  checkStyleKeys(node, style, 'line', ctx)
  let geom: LineGeometry
  if (node.tag === 'line' || node.tag === 'arrow') {
    geom = {
      kind: node.tag === 'arrow' ? 'arrow' : 'line',
      x1: parseNumber(node.attrs.x1) ?? 0,
      y1: parseNumber(node.attrs.y1) ?? 0,
      x2: parseNumber(node.attrs.x2) ?? 0,
      y2: parseNumber(node.attrs.y2) ?? 0,
      head: node.tag === 'arrow' ? parsePx(readProp(node, style, 'head', ctx)) : undefined,
    }
  } else if (node.tag === 'polyline' || node.tag === 'polygon') {
    const pts = (node.attrs.points ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [xs, ys] = pair.split(',')
        return { x: Number(xs), y: Number(ys) }
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    geom = { kind: node.tag === 'polygon' ? 'polygon' : 'polyline', points: pts }
  } else {
    geom = { kind: 'path', d: node.attrs.d ?? '' }
  }
  const strokeWidth = parsePx(readProp(node, style, 'stroke-width', ctx)) ?? 4
  const stroke = readProp(node, style, 'stroke', ctx) ?? defaultStroke
  const fill = readProp(node, style, 'fill', ctx) ?? 'none'
  const cap = readProp(node, style, 'stroke-linecap', ctx)?.trim()
  const join = readProp(node, style, 'stroke-linejoin', ctx)?.trim()
  const dash = parseDashArray(readProp(node, style, 'stroke-dasharray', ctx))
  const effects = readEffects(node, style, ctx, stroke)
  const box = lineBounds(geom, strokeWidth)
  const localGeom = normalizeLineGeometry(geom, box)
  return {
    kind: 'line',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    line: node.line,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    ink: { x: 0, y: 0, width: box.width, height: box.height },
    padding: ZERO_EDGES,
    ...effects,
    geometry: localGeom,
    stroke,
    strokeWidth,
    fill,
    strokeLinecap: cap && LINE_CAPS.has(cap) ? (cap as LineCap) : undefined,
    strokeLinejoin: join && LINE_JOINS.has(join) ? (join as LineJoin) : undefined,
    dash,
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
    ctx.issues.push({ level: 'warn', code: 'invalid-child', path: ctx.pathPrefix, message: '线条不能放在 row/column 内' })
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
    const s = layoutShape(node, ctx)
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
  if (ROOT_TAGS.has(node.tag)) {
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
  ctx.issues.push({ level: 'warn', code: 'unknown-tag', path: ctx.pathPrefix, message: `未知标签 ${node.tag}` })
  return null
}

async function layoutFlex(node: FvgNode, ctx: LayoutContext): Promise<FlexLayoutNode> {
  const direction = node.tag === 'row' ? 'row' : 'column'
  const style = parseStyle(node.attrs.style)
  checkStyleKeys(node, style, 'flex', ctx)
  const appearance = readAppearance(node, style, ctx)
  const gap = parsePx(style.gap) ?? 0
  const justify = mapJustify(style['justify-content'])
  const alignItems = mapAlign(style['align-items'])

  const fixedW = parsePx(readProp(node, style, 'width', ctx))
  const fixedH = parsePx(readProp(node, style, 'height', ctx))
  const childNodes = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const measuredNodes: FvgNode[] = []
  const measures: FlexMeasure[] = []
  for (let i = 0; i < childNodes.length; i++) {
    const ch = childNodes[i]!
    const childCtx: LayoutContext = { ...ctx, parent: 'flex', pathPrefix: nodePath(ctx.pathPrefix, ch.tag, i) }
    for (const attr of POSITION_ATTRS) {
      if (ch.attrs[attr] == null) continue
      pushIssue(ctx, {
        level: 'warn',
        code: 'ignored-position',
        path: childCtx.pathPrefix,
        message: `${attr} 在 ${node.tag} 里无效，位置由排列决定`,
      })
    }
    const m = await measureFlexChild(ch, childCtx, direction)
    if (m) {
      measures.push(m)
      measuredNodes.push(ch)
    }
  }

  let crossAvailable =
    direction === 'row'
      ? fixedH != null
        ? fixedH - appearance.padding.top - appearance.padding.bottom - (appearance.border?.width ?? 0) * 2
        : Math.max(0, ...measures.map((m) => m.preferredCross))
      : fixedW != null
        ? fixedW - appearance.padding.left - appearance.padding.right - (appearance.border?.width ?? 0) * 2
        : Math.min(ctx.maxContentWidth, Math.max(0, ...measures.map((m) => m.preferredCross)))

  const Yoga = await ensureYoga()
  const config = Yoga.Config.create()
  config.setUseWebDefaults(true)
  const root = Yoga.Node.createWithConfig(config)
  root.setFlexDirection(direction === 'row' ? FlexDirection.Row : FlexDirection.Column)
  root.setJustifyContent(justify)
  root.setAlignItems(alignItems)
  if (gap > 0) root.setGap(direction === 'row' ? Gutter.Column : Gutter.Row, gap)

  /** Column 里的文字按列宽换行后，高度要跟着重新量 */
  const columnWidths = measures.map((m, i) => {
    const cross = m.preferredCross === Infinity ? crossAvailable : m.preferredCross
    if (direction !== 'column' || !m.isText || m.node.kind !== 'text') return cross
    const width = Math.max(m.minCross, Math.min(cross, crossAvailable))
    if (width < m.preferredCross - 1e-3) {
      const t = m.node
      const innerW = width - t.padding.left - t.padding.right - (t.border?.width ?? 0) * 2
      m.preferredMain = layoutTextBox(measuredNodes[i]!, { ...ctx, parent: 'flex', pathPrefix: t.path }, innerW).height
    }
    return width
  })

  const naturalMain = measures.reduce((sum, m) => sum + m.preferredMain, 0) + gap * Math.max(0, measures.length - 1)
  const mainAvailable =
    direction === 'row'
      ? fixedW != null
        ? fixedW - appearance.padding.left - appearance.padding.right - (appearance.border?.width ?? 0) * 2
        : Math.min(ctx.maxContentWidth, naturalMain)
      : fixedH != null
        ? fixedH - appearance.padding.top - appearance.padding.bottom - (appearance.border?.width ?? 0) * 2
        : naturalMain

  if (direction === 'row') {
    root.setWidth(Math.max(0, mainAvailable))
    root.setHeight(Math.max(0, crossAvailable === Infinity ? 0 : crossAvailable))
  } else {
    root.setWidth(Math.max(0, crossAvailable))
    root.setHeight(Math.max(0, mainAvailable))
  }

  const contentOffsetX = appearance.padding.left + (appearance.border?.width ?? 0)
  const contentOffsetY = appearance.padding.top + (appearance.border?.width ?? 0)

  const yogaChildren: YogaNode[] = []
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!
    const childFvg = measuredNodes[i]!
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
      yn.setWidth(columnWidths[i]!)
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
      const assignedW = layout.width
      const innerW = assignedW - child.padding.left - child.padding.right - (child.border?.width ?? 0) * 2
      const currentInner = child.width - child.padding.left - child.padding.right - (child.border?.width ?? 0) * 2
      // Yoga 会把宽度收成整数。差不到 1px 时沿用已排好的单行，避免误触发换行。
      if (innerW < currentInner - 1) {
        const re = layoutTextBox(measuredNodes[i]!, { ...ctx, parent: 'flex', pathPrefix: child.path }, innerW)
        re.x = layout.left + contentOffsetX
        re.y = layout.top + contentOffsetY
        child = re
      } else {
        child = {
          ...child,
          x: layout.left + contentOffsetX,
          y: layout.top + contentOffsetY,
        }
      }
    } else {
      child = {
        ...child,
        x: layout.left + contentOffsetX,
        y: layout.top + contentOffsetY,
        width: layout.width,
        height: layout.height,
      }
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
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'row/column 内容超出写死的 width' })
  }
  if (fixedH != null && outer.height > fixedH + 1e-3) {
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'row/column 内容超出写死的 height' })
  }

  return {
    kind: 'flex',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    line: node.line,
    x: 0,
    y: 0,
    width: fixedW ?? outer.width,
    height: fixedH ?? outer.height,
    ink: { x: contentOffsetX, y: contentOffsetY, width: contentW, height: contentH },
    ...appearance,
    direction,
    gap,
    children: laidChildren,
  }
}

async function layoutLayer(node: FvgNode, ctx: LayoutContext, isRoot = false): Promise<LayerLayoutNode> {
  const style = parseStyle(node.attrs.style)
  checkStyleKeys(node, style, isRoot ? 'root' : 'layer', ctx)
  const appearance = readAppearance(node, style, ctx)
  const fixedW = parsePx(readProp(node, style, 'width', ctx))
  const fixedH = parsePx(readProp(node, style, 'height', ctx))

  const childFvg = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const placed: Array<{
    child: LayoutNode
    cx?: number
    cy?: number
    anchor: Anchor
    useDefaultCenter: boolean
    /** 线条的位置由自身坐标决定，不参与 cx/cy 摆放 */
    fixed: boolean
  }> = []

  for (let i = 0; i < childFvg.length; i++) {
    const ch = childFvg[i]!
    const path = nodePath(ctx.pathPrefix, ch.tag, i)
    const subCtx: LayoutContext = { ...ctx, parent: 'layer', pathPrefix: path }
    let laid: LayoutNode | null = null
    if (isLineTag(ch.tag)) laid = layoutLineNode(ch, subCtx, ctx.color)
    else if (isTextBoxTag(ch.tag)) laid = layoutTextBox(ch, subCtx, ctx.maxContentWidth)
    else if (isShapeTag(ch.tag)) laid = layoutShape(ch, subCtx)
    else if (isFlexTag(ch.tag)) laid = await layoutFlex(ch, subCtx)
    else if (ROOT_TAGS.has(ch.tag)) laid = await layoutLayer(ch, subCtx)
    else {
      ctx.issues.push({ level: 'warn', code: 'unknown-tag', path, message: `未知标签 ${ch.tag}` })
      continue
    }
    const cx = parseNumber(ch.attrs.cx)
    const cy = parseNumber(ch.attrs.cy)
    placed.push({
      child: laid,
      cx: cx ?? undefined,
      cy: cy ?? undefined,
      anchor: parseAnchor(ch.attrs.anchor),
      useDefaultCenter: cx == null || cy == null,
      fixed: laid.kind === 'line',
    })
  }

  let layerW = fixedW ?? 0
  let layerH = fixedH ?? 0

  const positionOne = (p: (typeof placed)[0], lw: number, lh: number) => {
    if (p.fixed) return
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
    line: node.line,
    x: 0,
    y: 0,
    width: layerW,
    height: layerH,
    ink,
    ...appearance,
    children,
  }
}

export async function layoutSource(source: string, baseDir: string): Promise<FvgDocument> {
  const nodes = parseFvg(source)
  const fontNodes: Array<{ family: string; src: string }> = []
  let rootNode: FvgNode | null = null
  for (const n of nodes) {
    if (n.tag === FONT_TAG) {
      fontNodes.push({ family: n.attrs.family ?? '', src: n.attrs.src ?? '' })
    } else if (!rootNode) {
      rootNode = n
    }
  }
  if (!rootNode) throw new Error('FVG 缺少根元素 <fvg> 或 <layer>')
  await registerFontsFromDocument(fontNodes.filter((f) => f.family && f.src), baseDir)

  const style = parseStyle(rootNode.attrs.style)
  const issues: Issue[] = []
  const readCtx: LayoutContext = { color: '', fontFamily: '', maxContentWidth: 0, issues, pathPrefix: 'fvg' }
  const read = (key: string) => readProp(rootNode!, style, key, readCtx)
  const width = parsePx(read('width')) ?? 1080
  const height = parsePx(read('height')) ?? 1920
  const background = read('background') ?? '#ffffff'
  const color = read('color') ?? '#111111'
  const fontFamily = read('font-family')?.trim() || 'ChillDuanSans'
  const safe = parseSafe(read('safe'), width, height)
  const maxContentWidth = width - safe.left - safe.right

  const root = await layoutLayer(
    rootNode.tag === 'fvg' ? { ...rootNode, tag: 'layer' } : rootNode,
    {
      color,
      fontFamily,
      maxContentWidth,
      issues,
      pathPrefix: 'fvg',
    },
    true,
  )

  root.width = width
  root.height = height

  return { width, height, background, color, fontFamily, safe, root, issues }
}

export type { FvgDocument }

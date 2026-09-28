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
import { isFontAvailable, registerFontsFromDocument } from './fonts.js'
import { loadFvgImage, objectFitRect } from './images.js'
import {
  parseBorder,
  parseCorners,
  parseDash,
  parseEdges,
  parseFontWeight,
  parseLineCap,
  parseLineJoin,
  parseNumber,
  parseObjectFit,
  parseOverflow,
  parsePaint,
  parsePx,
  parseShadows,
  parseStyle,
  parseZIndex,
  ZERO_EDGES,
  type CornerRadii,
  type Edges,
  type PaintFill,
  type Shadow,
} from './style.js'
import {
  defaultFontSizeForTag,
  defaultFontWeightForTag,
  extractTextSegments,
  isTextBoxTag,
  layoutText,
} from './text.js'
import { FONT_TAG, isFlexTag, isImageTag, isLineTag, isShapeTag, ROOT_TAGS } from './tags.js'
import type {
  Anchor,
  Box,
  FlexLayoutNode,
  FvgDocument,
  ImageLayoutNode,
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
  baseDir: string
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

function warnInvalid(ctx: LayoutContext, raw: string, label: string) {
  ctx.issues.push({
    level: 'warn',
    code: 'invalid-attr',
    path: ctx.pathPrefix,
    message: `无法解析 ${label}="${raw}"`,
  })
}

function parsedLen(ctx: LayoutContext, raw: string | undefined, label: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const n = parsePx(raw)
  if (n === undefined) warnInvalid(ctx, raw, label)
  return n
}

function parsedNum(ctx: LayoutContext, raw: string | undefined, label: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const n = parseNumber(raw)
  if (n === undefined) warnInvalid(ctx, raw, label)
  return n
}

function readStrokeExtras(attrs: Record<string, string>, style: Record<string, string>, ctx: LayoutContext) {
  const dashRaw = attrs['stroke-dasharray'] ?? style['stroke-dasharray']
  let dash: number[] | undefined
  if (dashRaw != null && dashRaw.trim() !== '' && dashRaw.trim().toLowerCase() !== 'none') {
    dash = parseDash(dashRaw)
    if (!dash) warnInvalid(ctx, dashRaw, 'stroke-dasharray')
  }
  const capRaw = attrs['stroke-linecap'] ?? style['stroke-linecap']
  const strokeLinecap = parseLineCap(capRaw)
  if (capRaw != null && capRaw.trim() !== '' && !strokeLinecap) warnInvalid(ctx, capRaw, 'stroke-linecap')
  const joinRaw = attrs['stroke-linejoin'] ?? style['stroke-linejoin']
  const strokeLinejoin = parseLineJoin(joinRaw)
  if (joinRaw != null && joinRaw.trim() !== '' && !strokeLinejoin) warnInvalid(ctx, joinRaw, 'stroke-linejoin')
  return { dash, strokeLinecap, strokeLinejoin }
}

const ZERO_RADII: CornerRadii = { tl: 0, tr: 0, br: 0, bl: 0 }

function readPaint(ctx: LayoutContext, raw: string | undefined, label: string): PaintFill | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const paint = parsePaint(raw)
  if (paint === undefined) {
    warnInvalid(ctx, raw, label)
    return undefined
  }
  return paint
}

function readShadowList(ctx: LayoutContext, raw: string | undefined, label: string): Shadow[] | undefined {
  if (raw == null || raw.trim() === '' || raw.trim().toLowerCase() === 'none') return undefined
  const shadows = parseShadows(raw)
  if (!shadows) {
    warnInvalid(ctx, raw, label)
    return undefined
  }
  return shadows
}

function readAppearance(attrs: Record<string, string>, style: Record<string, string>, ctx: LayoutContext) {
  const padding = parseEdges(style.padding) ?? ZERO_EDGES
  const border = parseBorder(style.border)
  const radiusRaw = style['border-radius']
  let radii = ZERO_RADII
  if (radiusRaw != null && radiusRaw.trim() !== '') {
    const parsed = parseCorners(radiusRaw)
    if (!parsed) warnInvalid(ctx, radiusRaw, 'border-radius')
    else radii = parsed
  }
  const borderRadius = Math.max(radii.tl, radii.tr, radii.br, radii.bl)
  const background = readPaint(ctx, style.background ?? style['background-color'], 'background')
  const boxShadow = readShadowList(ctx, style['box-shadow'], 'box-shadow')
  const overflowRaw = style.overflow
  let overflow: 'visible' | 'hidden' = 'visible'
  if (overflowRaw != null && overflowRaw.trim() !== '') {
    const parsed = parseOverflow(overflowRaw)
    if (!parsed) warnInvalid(ctx, overflowRaw, 'overflow')
    else overflow = parsed
  }
  const zRaw = style['z-index'] ?? attrs['z-index']
  let zIndex = 0
  if (zRaw != null && zRaw.trim() !== '') {
    const parsed = parseZIndex(zRaw)
    if (parsed === undefined) warnInvalid(ctx, zRaw, 'z-index')
    else zIndex = parsed
  }
  return {
    padding,
    border,
    borderRadius,
    radii,
    background,
    boxShadow,
    overflow,
    zIndex,
    opacity: parsedNum(ctx, attrs.opacity, 'opacity') ?? 1,
    rotate: parsedNum(ctx, attrs.rotate, 'rotate') ?? 0,
    scale: parsedNum(ctx, attrs.scale, 'scale') ?? 1,
  }
}

function shadowOutset(shadows: Shadow[] | undefined): { left: number; right: number; top: number; bottom: number } {
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  for (const shadow of shadows ?? []) {
    const blur = Math.abs(shadow.blur) * 2
    left = Math.max(left, blur - shadow.x)
    right = Math.max(right, blur + shadow.x)
    top = Math.max(top, blur - shadow.y)
    bottom = Math.max(bottom, blur + shadow.y)
  }
  return { left, right, top, bottom }
}

function inflateBox(box: Box, pad: { left: number; right: number; top: number; bottom: number }): Box {
  return {
    x: box.x - pad.left,
    y: box.y - pad.top,
    width: box.width + pad.left + pad.right,
    height: box.height + pad.top + pad.bottom,
  }
}

function withEffectsInk<T extends LayoutNode>(node: T): T {
  let ink = node.ink
  if (node.kind === 'text') {
    let stroke = 0
    const shadows: Shadow[] = []
    for (const line of node.textLayout.lines) {
      for (const seg of line.segments) {
        if (seg.style.textStroke) stroke = Math.max(stroke, seg.style.textStroke.width)
        if (seg.style.textShadow) shadows.push(...seg.style.textShadow)
      }
    }
    if (stroke > 0) {
      const half = stroke / 2
      ink = inflateBox(ink, { left: half, right: half, top: half, bottom: half })
    }
    const textPad = shadowOutset(shadows)
    if (textPad.left || textPad.right || textPad.top || textPad.bottom) ink = inflateBox(ink, textPad)
  }
  const boxPad = shadowOutset(node.boxShadow)
  if (boxPad.left || boxPad.right || boxPad.top || boxPad.bottom) {
    ink = unionBoxes(ink, inflateBox({ x: 0, y: 0, width: node.width, height: node.height }, boxPad))
  }
  return ink === node.ink ? node : { ...node, ink }
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

function mapAlignExact(v: string | undefined): Align | undefined {
  switch ((v ?? '').trim()) {
    case 'start':
      return Align.FlexStart
    case 'end':
      return Align.FlexEnd
    case 'center':
      return Align.Center
    case 'stretch':
      return Align.Stretch
    default:
      return undefined
  }
}

function mapAlign(v: string | undefined): Align {
  return mapAlignExact(v) ?? Align.Center
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
    const b = p.computeTightBounds()
    if (b && b.length >= 4 && Number.isFinite(b[0])) {
      return { x: b[0] - pad, y: b[1] - pad, width: b[2] - b[0] + pad * 2, height: b[3] - b[1] + pad * 2 }
    }
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

function translatePath(d: string, ox: number, oy: number): string {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi)
  if (!tokens) return d
  const counts: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 }
  let i = 0
  let cmd = ''
  const out: string[] = []
  while (i < tokens.length) {
    const token = tokens[i]!
    if (/[a-zA-Z]/.test(token)) {
      cmd = token
      i++
      out.push(cmd)
    }
    const op = cmd.toUpperCase()
    const n = counts[op]
    if (n == null || n === 0) continue
    const abs = cmd === cmd.toUpperCase()
    const nums: number[] = []
    for (let k = 0; k < n && i < tokens.length && !/[a-zA-Z]/.test(tokens[i]!); k++) nums.push(Number(tokens[i++]))
    if (nums.length < n) break
    if (abs) {
      if (op === 'H') nums[0] = (nums[0] ?? 0) - ox
      else if (op === 'V') nums[0] = (nums[0] ?? 0) - oy
      else if (op === 'A') {
        nums[5] = (nums[5] ?? 0) - ox
        nums[6] = (nums[6] ?? 0) - oy
      } else {
        for (let k = 0; k < nums.length; k += 2) {
          nums[k] = (nums[k] ?? 0) - ox
          nums[k + 1] = (nums[k + 1] ?? 0) - oy
        }
      }
    }
    out.push(...nums.map((n) => String(Math.round(n * 1000) / 1000)))
    if (op === 'M') cmd = abs ? 'L' : 'l'
  }
  return out.join(' ')
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
  if (geom.kind === 'path') return { ...geom, d: translatePath(geom.d, ox, oy) }
  return geom
}

function layoutTextBox(node: FvgNode, ctx: LayoutContext, contentWidthLimit?: number): TextLayoutNode {
  const style = parseStyle(node.attrs.style)
  const tag = node.tag.toLowerCase()
  const fontSize = parsedLen(ctx, style['font-size'], 'font-size') ?? defaultFontSizeForTag(tag)
  const fontWeight = parseFontWeight(style['font-weight']) ?? defaultFontWeightForTag(tag)
  const fontFamily = style['font-family']?.trim() || ctx.fontFamily
  if (style['font-family']?.trim() && !isFontAvailable(fontFamily)) {
    ctx.issues.push({
      level: 'warn',
      code: 'invalid-attr',
      path: ctx.pathPrefix,
      message: `字体未注册 ${fontFamily}，已改用 ${ctx.fontFamily}`,
    })
  }
  const color = style.color ?? ctx.color
  const segments = extractTextSegments(
    node,
    {
      fontFamily,
      fontSize,
      fontWeight,
      color,
      letterSpacing: parsePx(style['letter-spacing']) ?? 0,
      lineHeightRatio: parseNumber(style['line-height']) ?? 1.2,
    },
    (label, raw) => warnInvalid(ctx, raw, label),
  )
  const nowrap = style['white-space'] === 'nowrap'
  const textWrap = style['text-wrap'] === 'wrap' ? 'wrap' : 'balance'
  const fixedW = parsedLen(ctx, style.width, 'width')
  const fixedH = parsedLen(ctx, style.height, 'height')
  const maxW = parsedLen(ctx, style['max-width'], 'max-width') ?? contentWidthLimit
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

  return withEffectsInk({
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
  })
}

function layoutShape(node: FvgNode, ctx: LayoutContext, defaultStroke: string): ShapeLayoutNode {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const radius = parsedLen(ctx, node.attrs.r, 'r')
  const rxAttr = parsedLen(ctx, node.attrs.rx, 'rx')
  const ryAttr = parsedLen(ctx, node.attrs.ry, 'ry')
  let w = 0
  let h = 0
  if (node.tag === 'Circle') {
    w = h = (radius ?? 0) * 2
  } else if (node.tag === 'Ellipse') {
    w = (rxAttr ?? 0) * 2
    h = (ryAttr ?? 0) * 2
  } else {
    w = parsedLen(ctx, node.attrs.width, 'width') ?? parsedLen(ctx, style.width, 'width') ?? 0
    h = parsedLen(ctx, node.attrs.height, 'height') ?? parsedLen(ctx, style.height, 'height') ?? 0
  }
  const fill = readPaint(ctx, node.attrs.fill ?? style.fill ?? '#000000', 'fill') ?? 'none'
  const stroke = node.attrs.stroke ?? style.stroke ?? 'none'
  const strokeWidth = parsedLen(ctx, node.attrs['stroke-width'], 'stroke-width') ?? parsedLen(ctx, style['stroke-width'], 'stroke-width') ?? 1
  const strokeExtras = readStrokeExtras(node.attrs, style, ctx)
  const ink = { x: 0, y: 0, width: w, height: h }
  return withEffectsInk({
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
    ...strokeExtras,
    rx: rxAttr,
    r: radius,
    rxEllipse: rxAttr,
    ry: ryAttr,
  })
}

async function layoutImage(node: FvgNode, ctx: LayoutContext): Promise<ImageLayoutNode> {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const fitRaw = style['object-fit'] ?? node.attrs['object-fit']
  let objectFit: 'fill' | 'contain' | 'cover' = 'fill'
  if (fitRaw != null && fitRaw.trim() !== '') {
    const parsed = parseObjectFit(fitRaw)
    if (!parsed) warnInvalid(ctx, fitRaw, 'object-fit')
    else objectFit = parsed
  }
  const src = node.attrs.src ?? ''
  let image: ImageLayoutNode['image'] = null
  let intrinsicWidth = 0
  let intrinsicHeight = 0
  try {
    const loaded = await loadFvgImage(src, ctx.baseDir)
    image = loaded.image
    intrinsicWidth = loaded.width
    intrinsicHeight = loaded.height
  } catch {
    ctx.issues.push({
      level: 'warn',
      code: 'missing-image',
      path: ctx.pathPrefix,
      message: `图片无法打开 ${src || '(空)'}`,
    })
  }
  let width = parsedLen(ctx, node.attrs.width, 'width') ?? parsedLen(ctx, style.width, 'width')
  let height = parsedLen(ctx, node.attrs.height, 'height') ?? parsedLen(ctx, style.height, 'height')
  if (image && intrinsicWidth > 0 && intrinsicHeight > 0) {
    if (width == null && height == null) {
      width = intrinsicWidth
      height = intrinsicHeight
    } else if (width == null && height != null) width = (height * intrinsicWidth) / intrinsicHeight
    else if (height == null && width != null) height = (width * intrinsicHeight) / intrinsicWidth
  }
  const w = width ?? 0
  const h = height ?? 0
  const fitted = image ? objectFitRect(objectFit, intrinsicWidth, intrinsicHeight, w, h) : null
  const ink = fitted && fitted.dw > 0 && fitted.dh > 0 ? { x: fitted.dx, y: fitted.dy, width: fitted.dw, height: fitted.dh } : emptyBox()
  return withEffectsInk({
    kind: 'image',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: w,
    height: h,
    ink,
    ...appearance,
    src,
    image,
    objectFit,
    intrinsicWidth,
    intrinsicHeight,
  })
}

function layoutLineNode(node: FvgNode, ctx: LayoutContext, defaultStroke: string): LineLayoutNode {
  let geom: LineGeometry
  if (node.tag === 'Line' || node.tag === 'Arrow') {
    geom = {
      kind: node.tag === 'Arrow' ? 'arrow' : 'line',
      x1: parsedLen(ctx, node.attrs.x1, 'x1') ?? 0,
      y1: parsedLen(ctx, node.attrs.y1, 'y1') ?? 0,
      x2: parsedLen(ctx, node.attrs.x2, 'x2') ?? 0,
      y2: parsedLen(ctx, node.attrs.y2, 'y2') ?? 0,
      head: parsedLen(ctx, node.attrs.head, 'head'),
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
  const strokeWidth = parsedLen(ctx, node.attrs['stroke-width'], 'stroke-width') ?? 4
  const stroke = node.attrs.stroke ?? defaultStroke
  const fill = node.attrs.fill ?? 'none'
  const strokeExtras = readStrokeExtras(node.attrs, {}, ctx)
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
    opacity: parsedNum(ctx, node.attrs.opacity, 'opacity') ?? 1,
    rotate: parsedNum(ctx, node.attrs.rotate, 'rotate') ?? 0,
    scale: parsedNum(ctx, node.attrs.scale, 'scale') ?? 1,
    padding: ZERO_EDGES,
    geometry: localGeom,
    stroke,
    strokeWidth,
    fill,
    ...strokeExtras,
  }
}

const INLINE_TAGS = new Set(['span', 'strong', 'b', 'em', 'br'])

function hasBlockChildren(node: FvgNode): boolean {
  return node.children.some((child) => typeof child !== 'string' && !INLINE_TAGS.has(child.tag.toLowerCase()))
}

type FlexMeasure = {
  source: FvgNode
  node: LayoutNode
  minMain: number
  minCross: number
  preferredMain: number
  preferredCross: number
  isText: boolean
}

function flexMetrics(direction: 'row' | 'column', node: LayoutNode, isText: boolean): Omit<FlexMeasure, 'source'> {
  return {
    node,
    minMain: direction === 'row' ? ('textLayout' in node ? node.textLayout.minWidth : node.width) : node.height,
    minCross: direction === 'row' ? node.height : 'textLayout' in node ? node.textLayout.minWidth : node.width,
    preferredMain: direction === 'row' ? node.width : node.height,
    preferredCross: direction === 'row' ? node.height : node.width,
    isText,
  }
}

async function measureFlexChild(node: FvgNode, ctx: LayoutContext, direction: 'row' | 'column'): Promise<FlexMeasure | null> {
  if (isLineTag(node.tag)) {
    ctx.issues.push({ level: 'warn', code: 'invalid-child', path: ctx.pathPrefix, message: '线条不能放在 Row/Column 内' })
    return null
  }
  if (isTextBoxTag(node.tag) && !hasBlockChildren(node)) {
    const laid = layoutTextBox(node, ctx, ctx.maxContentWidth)
    return { source: node, ...flexMetrics(direction, laid, true) }
  }
  if (isShapeTag(node.tag)) {
    const s = layoutShape(node, ctx, ctx.color)
    return { source: node, ...flexMetrics(direction, s, false) }
  }
  if (isImageTag(node.tag)) {
    const image = await layoutImage(node, ctx)
    return { source: node, ...flexMetrics(direction, image, false) }
  }
  if (isFlexTag(node.tag) || (isTextBoxTag(node.tag) && hasBlockChildren(node))) {
    const nested = await layoutFlex(node, ctx)
    return { source: node, ...flexMetrics(direction, nested, false) }
  }
  if (ROOT_TAGS.has(node.tag) || node.tag === 'Layer') {
    const nested = await layoutLayer(node, ctx)
    return { source: node, ...flexMetrics(direction, nested, false) }
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

  const fixedW = parsedLen(ctx, style.width, 'width')
  const fixedH = parsedLen(ctx, style.height, 'height')
  const borderW = appearance.border?.width ?? 0
  const padX = appearance.padding.left + appearance.padding.right + borderW * 2
  const padY = appearance.padding.top + appearance.padding.bottom + borderW * 2
  const insetX = appearance.padding.left + borderW
  const insetY = appearance.padding.top + borderW
  const measureLimit =
    fixedW != null ? Math.max(0, Math.min(ctx.maxContentWidth, fixedW - padX)) : ctx.maxContentWidth

  const childNodes = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const measures: FlexMeasure[] = []
  for (let i = 0; i < childNodes.length; i++) {
    const ch = childNodes[i]!
    const m = await measureFlexChild(
      ch,
      { ...ctx, maxContentWidth: measureLimit, pathPrefix: nodePath(ctx.pathPrefix, ch.tag, i) },
      direction,
    )
    if (m) measures.push(m)
  }

  const gapCount = Math.max(0, measures.length - 1)
  const intrinsicMain = measures.reduce((sum, m) => sum + m.preferredMain, 0) + gap * gapCount
  const intrinsicCross = measures.reduce((max, m) => Math.max(max, m.preferredCross), 0)
  const availableMain =
    direction === 'row'
      ? fixedW != null
        ? Math.max(0, fixedW - padX)
        : ctx.maxContentWidth
      : fixedH != null
        ? Math.max(0, fixedH - padY)
        : Number.POSITIVE_INFINITY
  const availableCross =
    direction === 'row'
      ? fixedH != null
        ? Math.max(0, fixedH - padY)
        : intrinsicCross
      : fixedW != null
        ? Math.max(0, fixedW - padX)
        : ctx.maxContentWidth
  const mainFixed = direction === 'row' ? fixedW != null : fixedH != null
  const mainSize = mainFixed ? availableMain : Math.min(availableMain, intrinsicMain)
  const crossSize = direction === 'row' ? (fixedH != null ? availableCross : intrinsicCross) : fixedW != null ? availableCross : Math.min(availableCross, intrinsicCross)

  const Yoga = await ensureYoga()
  const config = Yoga.Config.create()
  config.setUseWebDefaults(true)
  const root = Yoga.Node.createWithConfig(config)
  root.setFlexDirection(direction === 'row' ? FlexDirection.Row : FlexDirection.Column)
  root.setJustifyContent(justify)
  root.setAlignItems(alignItems)
  if (gap > 0) root.setGap(direction === 'row' ? Gutter.Column : Gutter.Row, gap)
  if (direction === 'row') {
    root.setWidth(Math.max(0, mainSize))
    root.setHeight(Math.max(0, crossSize))
  } else {
    root.setWidth(Math.max(0, crossSize))
    root.setHeight(Math.max(0, Number.isFinite(mainSize) ? mainSize : 0))
  }

  const yogaChildren: YogaNode[] = []
  for (const m of measures) {
    const chParsed = parseStyle(m.source.attrs.style)
    const { grow, shrink } = parseFlexGrowShrink(chParsed, m.isText)
    const yn = Yoga.Node.create()
    yn.setFlexGrow(grow)
    yn.setFlexShrink(shrink)
    yn.setFlexBasisAuto()
    const minOuterW =
      m.node.padding.left +
      m.node.padding.right +
      (m.node.border?.width ?? 0) * 2 +
      (m.isText && m.node.kind === 'text' ? m.node.textLayout.minWidth : 0)
    const selfRaw = chParsed['align-self']?.trim()
    const self = mapAlignExact(selfRaw)
    if (selfRaw && !self) warnInvalid(ctx, selfRaw, 'align-self')
    if (self) yn.setAlignSelf(self)
    const stretch = (self ?? alignItems) === Align.Stretch
    if (direction === 'row') {
      yn.setWidth(m.preferredMain)
      if (!stretch) yn.setHeight(m.preferredCross)
      yn.setMinWidth(m.isText ? minOuterW : m.minMain)
    } else {
      yn.setHeight(m.preferredMain)
      if (!stretch) yn.setWidth(m.preferredCross)
      yn.setMinWidth(m.isText ? minOuterW : 0)
    }
    yogaChildren.push(yn)
    root.insertChild(yn, yogaChildren.length - 1)
  }

  root.calculateLayout(undefined, undefined)

  const laidChildren: LayoutNode[] = []
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!
    const layout = yogaChildren[i]!.getComputedLayout()
    let child = m.node
    if (m.isText && child.kind === 'text') {
      const padChildX = child.padding.left + child.padding.right + (child.border?.width ?? 0) * 2
      const assignedOuter = direction === 'column' ? Math.min(layout.width, crossSize) : layout.width
      const innerW = assignedOuter - padChildX
      if (innerW + 1 < child.textLayout.contentWidth) {
        const re = layoutTextBox(m.source, { ...ctx, pathPrefix: child.path }, Math.max(0, innerW))
        re.x = layout.left + insetX
        re.y = layout.top + insetY
        child = re
      } else {
        child = { ...child, x: layout.left + insetX, y: layout.top + insetY }
      }
      if (direction === 'column' && layout.width > child.width + 0.5) child = { ...child, width: layout.width }
      if (direction === 'row' && layout.height > child.height + 0.5) child = { ...child, height: layout.height }
    } else {
      child = { ...child, x: layout.left + insetX, y: layout.top + insetY, width: layout.width, height: layout.height }
    }
    laidChildren.push(child)
  }

  for (const yn of yogaChildren) yn.free()
  root.freeRecursive()
  config.free()

  const innerW = direction === 'row' ? mainSize : crossSize
  const innerH = direction === 'row' ? crossSize : mainSize
  let contentInk = { x: insetX, y: insetY, width: innerW, height: innerH }
  for (const child of laidChildren) contentInk = unionBoxes(contentInk, translateBox(child.ink, child.x, child.y))
  const outer = outerFromContent(innerW, innerH, appearance.padding, appearance.border)
  if (fixedW != null && (direction === 'row' ? intrinsicMain : intrinsicCross) + padX > fixedW + 1e-3) {
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 width' })
  }
  if (fixedH != null && (direction === 'column' ? intrinsicMain : intrinsicCross) + padY > fixedH + 1e-3) {
    ctx.issues.push({ level: 'warn', code: 'flex-overflow', path: ctx.pathPrefix, message: 'Row/Column 内容超出写死的 height' })
  }

  return withEffectsInk({
    kind: 'flex',
    path: ctx.pathPrefix,
    id: node.attrs.id,
    tag: node.tag,
    x: 0,
    y: 0,
    width: fixedW ?? outer.width,
    height: fixedH ?? outer.height,
    ink: contentInk,
    ...appearance,
    direction,
    children: laidChildren,
  })
}

async function layoutLayer(node: FvgNode, ctx: LayoutContext): Promise<LayerLayoutNode> {
  const style = parseStyle(node.attrs.style)
  const appearance = readAppearance(node.attrs, style, ctx)
  const fixedW = parsedLen(ctx, style.width, 'width') ?? parsedLen(ctx, node.attrs.width, 'width')
  const fixedH = parsedLen(ctx, style.height, 'height') ?? parsedLen(ctx, node.attrs.height, 'height')

  const childFvg = node.children.filter((c) => typeof c !== 'string') as FvgNode[]
  const placed: Array<{ child: LayoutNode; cx?: number; cy?: number; anchor: Anchor; useDefaultCenter: boolean; fixedPos: boolean }> = []

  for (let i = 0; i < childFvg.length; i++) {
    const ch = childFvg[i]!
    const path = nodePath(ctx.pathPrefix, ch.tag, i)
    const subCtx = { ...ctx, pathPrefix: path }
    let laid: LayoutNode | null = null
    if (isLineTag(ch.tag)) laid = layoutLineNode(ch, subCtx, ctx.color)
    else if (isTextBoxTag(ch.tag) && !hasBlockChildren(ch)) laid = layoutTextBox(ch, subCtx, ctx.maxContentWidth)
    else if (isShapeTag(ch.tag)) laid = layoutShape(ch, subCtx, ctx.color)
    else if (isImageTag(ch.tag)) laid = await layoutImage(ch, subCtx)
    else if (isFlexTag(ch.tag) || (isTextBoxTag(ch.tag) && hasBlockChildren(ch))) laid = await layoutFlex(ch, subCtx)
    else if (ROOT_TAGS.has(ch.tag) || ch.tag === 'Layer') laid = await layoutLayer(ch, subCtx)
    else {
      ctx.issues.push({ level: 'warn', code: 'unknown-tag', path, message: `未知标签 ${ch.tag}` })
      continue
    }
    const cx = parsedLen(subCtx, ch.attrs.cx, 'cx')
    const cy = parsedLen(subCtx, ch.attrs.cy, 'cy')
    const fixedPos = laid.kind === 'line'
    placed.push({
      child: laid,
      cx: cx ?? undefined,
      cy: cy ?? undefined,
      anchor: parseAnchor(ch.attrs.anchor),
      useDefaultCenter: !fixedPos && (cx == null || cy == null),
      fixedPos,
    })
  }

  let layerW = fixedW ?? 0
  let layerH = fixedH ?? 0

  const positionOne = (p: (typeof placed)[0], lw: number, lh: number) => {
    if (p.fixedPos) return
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

  return withEffectsInk({
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
  })
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
  if (!rootNode) throw new Error('FVG 缺少根元素 <fvg> 或 <Layer>')
  await registerFontsFromDocument(fontNodes.filter((f) => f.family && f.src), baseDir)

  const attrs = rootNode.attrs
  const style = parseStyle(attrs.style)
  const width = parsePx(attrs.width) ?? parsePx(style.width) ?? 1080
  const height = parsePx(attrs.height) ?? parsePx(style.height) ?? 1920
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
      baseDir,
    },
  )

  root.width = width
  root.height = height

  return { width, height, background, color, fontFamily, safe, root, issues }
}

export type { FvgDocument }

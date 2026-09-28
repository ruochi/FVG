import { createCanvas, Path2D, type CanvasRenderingContext2D } from '@napi-rs/canvas'
import { buildFontString } from './fonts.js'
import { objectFitRect } from './images.js'
import type { Border, ColorStop, CornerRadii, PaintFill } from './style.js'
import type { ImageLayoutNode, LayerLayoutNode, LayoutNode, LineLayoutNode, ShapeLayoutNode, TextLayoutNode } from './types.js'

export type PaintOptions = {
  width: number
  height: number
  background: string
  scale: number
  debug: boolean
}

const ZERO_RADII: CornerRadii = { tl: 0, tr: 0, br: 0, bl: 0 }

function nodeRadii(node: LayoutNode): CornerRadii {
  if (node.radii) return node.radii
  const r = node.borderRadius ?? 0
  return { tl: r, tr: r, br: r, bl: r }
}

function clampRadii(w: number, h: number, radii: CornerRadii): CornerRadii {
  const fit = (a: number, b: number, limit: number) => {
    const sum = a + b
    return sum > limit && sum > 0 ? limit / sum : 1
  }
  const scale = Math.min(fit(radii.tl, radii.tr, w), fit(radii.bl, radii.br, w), fit(radii.tl, radii.bl, h), fit(radii.tr, radii.br, h))
  return { tl: radii.tl * scale, tr: radii.tr * scale, br: radii.br * scale, bl: radii.bl * scale }
}

function traceRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radii: CornerRadii) {
  const c = clampRadii(w, h, radii)
  ctx.beginPath()
  if (c.tl <= 0 && c.tr <= 0 && c.br <= 0 && c.bl <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + c.tl, y)
  ctx.lineTo(x + w - c.tr, y)
  if (c.tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + c.tr)
  else ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - c.br)
  if (c.br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - c.br, y + h)
  else ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + c.bl, y + h)
  if (c.bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - c.bl)
  else ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + c.tl)
  if (c.tl > 0) ctx.quadraticCurveTo(x, y, x + c.tl, y)
  else ctx.lineTo(x, y)
  ctx.closePath()
}

function shapeRadii(node: ShapeLayoutNode): CornerRadii {
  if (node.shape !== 'rect') return ZERO_RADII
  if (node.rx != null) {
    const r = Math.max(0, node.rx)
    return { tl: r, tr: r, br: r, bl: r }
  }
  return nodeRadii(node)
}

function traceOutline(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  if (node.kind === 'shape' && node.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(node.x + node.width / 2, node.y + node.height / 2, node.r ?? Math.min(node.width, node.height) / 2, 0, Math.PI * 2)
    return
  }
  if (node.kind === 'shape' && node.shape === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(
      node.x + node.width / 2,
      node.y + node.height / 2,
      node.rxEllipse ?? node.width / 2,
      node.ry ?? node.height / 2,
      0,
      0,
      Math.PI * 2,
    )
    return
  }
  const radii = node.kind === 'shape' ? shapeRadii(node) : nodeRadii(node)
  traceRoundRect(ctx, node.x, node.y, node.width, node.height, radii)
}

function hasRadius(radii: CornerRadii): boolean {
  return radii.tl > 0 || radii.tr > 0 || radii.br > 0 || radii.bl > 0
}

function isVisiblePaint(fill: PaintFill | undefined): fill is PaintFill {
  return fill != null && fill !== 'transparent' && fill !== 'none'
}

function stopOffsets(stops: ColorStop[], length: number): number[] {
  const n = stops.length
  const specified = stops.map((stop) => (stop.at != null && length > 0 ? stop.at / length : undefined))
  if (specified.every((value) => value == null)) return stops.map((_, i) => (n === 1 ? 0 : i / (n - 1)))
  const out: Array<number | undefined> = specified.slice()
  if (out[0] == null) out[0] = 0
  if (out[n - 1] == null) out[n - 1] = 1
  let i = 0
  while (i < n) {
    if (out[i] != null) {
      i++
      continue
    }
    let j = i
    while (j < n && out[j] == null) j++
    const start = out[i - 1] ?? 0
    const end = out[j] ?? 1
    const span = j - (i - 1)
    for (let k = i; k < j; k++) out[k] = start + ((k - (i - 1)) / span) * (end - start)
    i = j
  }
  return out.map((value) => Math.min(1, Math.max(0, value ?? 0)))
}

function addStops(gradient: CanvasGradient, stops: ColorStop[], length: number) {
  const pairs = stops
    .map((stop, i) => ({ color: stop.color, offset: stopOffsets(stops, length)[i]! }))
    .sort((a, b) => a.offset - b.offset)
  for (const pair of pairs) gradient.addColorStop(pair.offset, pair.color)
}

function applyFillStyle(ctx: CanvasRenderingContext2D, fill: PaintFill, x: number, y: number, w: number, h: number) {
  if (typeof fill === 'string') {
    ctx.fillStyle = fill
    return
  }
  if (fill.kind === 'linear') {
    const rad = (fill.angle * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = -Math.cos(rad)
    const len = Math.abs(w * dx) + Math.abs(h * dy)
    const cx = x + w / 2
    const cy = y + h / 2
    const gradient = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2)
    addStops(gradient, fill.stops, len || 1)
    ctx.fillStyle = gradient
    return
  }
  const cx = x + w / 2
  const cy = y + h / 2
  const radius = Math.hypot(w, h) / 2
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius || 1)
  addStops(gradient, fill.stops, radius || 1)
  ctx.fillStyle = gradient
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'rgba(0,0,0,0)'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function drawBoxShadow(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  const shadows = node.boxShadow
  if (!shadows?.length || node.width <= 0 || node.height <= 0) return
  for (let i = shadows.length - 1; i >= 0; i--) {
    const shadow = shadows[i]!
    ctx.save()
    ctx.shadowOffsetX = shadow.x
    ctx.shadowOffsetY = shadow.y
    ctx.shadowBlur = shadow.blur
    ctx.shadowColor = shadow.color
    traceOutline(ctx, node)
    ctx.fillStyle = '#000000'
    ctx.fill()
    clearShadow(ctx)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
    ctx.restore()
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  if (!isVisiblePaint(node.background)) return
  applyFillStyle(ctx, node.background, node.x, node.y, node.width, node.height)
  const radii = nodeRadii(node)
  if (hasRadius(radii)) {
    traceRoundRect(ctx, node.x, node.y, node.width, node.height, radii)
    ctx.fill()
  } else {
    ctx.fillRect(node.x, node.y, node.width, node.height)
  }
}

function applyBorderDash(ctx: CanvasRenderingContext2D, border: Border) {
  ctx.strokeStyle = border.color
  ctx.lineWidth = border.width
  if (border.style === 'dashed') {
    ctx.setLineDash([border.width * 3, border.width * 2])
    ctx.lineCap = 'butt'
  } else if (border.style === 'dotted') {
    ctx.setLineDash([0, border.width * 2])
    ctx.lineCap = 'round'
  } else {
    ctx.setLineDash([])
    ctx.lineCap = 'butt'
  }
}

function drawBorder(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  const border = node.border
  if (!border || border.width <= 0) return
  applyBorderDash(ctx, border)
  const radii = nodeRadii(node)
  if (hasRadius(radii) || border.style !== 'solid') {
    traceRoundRect(ctx, node.x, node.y, node.width, node.height, radii)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }
  ctx.strokeRect(
    node.x + border.width / 2,
    node.y + border.width / 2,
    node.width - border.width,
    node.height - border.width,
  )
}

function applyStroke(ctx: CanvasRenderingContext2D, dash: number[] | undefined, cap?: CanvasLineCap, join?: CanvasLineJoin) {
  ctx.setLineDash(dash && dash.length > 0 ? dash : [])
  if (cap) ctx.lineCap = cap
  if (join) ctx.lineJoin = join
}

function drawTextNode(ctx: CanvasRenderingContext2D, node: TextLayoutNode) {
  const contentX = node.x + node.padding.left + (node.border?.width ?? 0)
  const contentY = node.y + node.padding.top + (node.border?.width ?? 0)
  for (const line of node.textLayout.lines) {
    let offsetX = 0
    if (node.textAlign === 'center') offsetX = (node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width) / 2
    if (node.textAlign === 'right') offsetX = node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width
    for (const seg of line.segments) {
      ctx.font = buildFontString(seg.style.fontFamily, seg.style.fontWeight, seg.style.fontSize, seg.style.fontStyle ?? 'normal')
      ctx.letterSpacing = `${seg.style.letterSpacing}px`
      const x = contentX + offsetX + seg.x
      const y = contentY + line.baselineY
      const shadows = seg.style.textShadow
      if (shadows?.length) {
        for (let i = shadows.length - 1; i >= 0; i--) {
          const shadow = shadows[i]!
          ctx.shadowOffsetX = shadow.x
          ctx.shadowOffsetY = shadow.y
          ctx.shadowBlur = shadow.blur
          ctx.shadowColor = shadow.color
          ctx.fillStyle = seg.style.color
          ctx.fillText(seg.text, x, y)
        }
        clearShadow(ctx)
      }
      if (seg.style.textStroke && seg.style.textStroke.width > 0) {
        ctx.lineWidth = seg.style.textStroke.width
        ctx.strokeStyle = seg.style.textStroke.color
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.strokeText(seg.text, x, y)
      }
      ctx.fillStyle = seg.style.color
      ctx.fillText(seg.text, x, y)
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.translate(-node.width / 2, -node.height / 2)
  applyStroke(ctx, node.dash, node.strokeLinecap, node.strokeLinejoin)
  const radii = shapeRadii(node)
  if (node.shape === 'rect') {
    const rounded = hasRadius(radii)
    if (isVisiblePaint(node.fill)) {
      applyFillStyle(ctx, node.fill, 0, 0, node.width, node.height)
      if (rounded) {
        traceRoundRect(ctx, 0, 0, node.width, node.height, radii)
        ctx.fill()
      } else ctx.fillRect(0, 0, node.width, node.height)
    }
    if (node.stroke !== 'none') {
      ctx.strokeStyle = node.stroke
      ctx.lineWidth = node.strokeWidth
      if (rounded) {
        traceRoundRect(ctx, 0, 0, node.width, node.height, radii)
        ctx.stroke()
      } else ctx.strokeRect(0, 0, node.width, node.height)
    }
  } else if (node.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(node.width / 2, node.height / 2, node.r ?? node.width / 2, 0, Math.PI * 2)
    if (isVisiblePaint(node.fill)) {
      applyFillStyle(ctx, node.fill, 0, 0, node.width, node.height)
      ctx.fill()
    }
    if (node.stroke !== 'none') {
      ctx.strokeStyle = node.stroke
      ctx.lineWidth = node.strokeWidth
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.ellipse(node.width / 2, node.height / 2, node.rxEllipse ?? node.width / 2, node.ry ?? node.height / 2, 0, 0, Math.PI * 2)
    if (isVisiblePaint(node.fill)) {
      applyFillStyle(ctx, node.fill, 0, 0, node.width, node.height)
      ctx.fill()
    }
    if (node.stroke !== 'none') {
      ctx.strokeStyle = node.stroke
      ctx.lineWidth = node.strokeWidth
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawImageNode(ctx: CanvasRenderingContext2D, node: ImageLayoutNode) {
  if (!node.image || node.width <= 0 || node.height <= 0) return
  const fit = objectFitRect(node.objectFit, node.intrinsicWidth, node.intrinsicHeight, node.width, node.height)
  if (fit.sw <= 0 || fit.sh <= 0 || fit.dw <= 0 || fit.dh <= 0) return
  ctx.drawImage(node.image, fit.sx, fit.sy, fit.sw, fit.sh, node.x + fit.dx, node.y + fit.dy, fit.dw, fit.dh)
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, head: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawLine(ctx: CanvasRenderingContext2D, node: LineLayoutNode) {
  ctx.save()
  ctx.translate(node.x, node.y)
  ctx.strokeStyle = node.stroke
  ctx.fillStyle = node.stroke
  ctx.lineWidth = node.strokeWidth
  applyStroke(ctx, node.dash, node.strokeLinecap ?? 'round', node.strokeLinejoin ?? 'round')
  const g = node.geometry
  if (g.kind === 'line' || g.kind === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(g.x1, g.y1)
    ctx.lineTo(g.x2, g.y2)
    ctx.stroke()
    if (g.kind === 'arrow') {
      const head = g.head ?? Math.max(12, node.strokeWidth * 4)
      drawArrowHead(ctx, g.x1, g.y1, g.x2, g.y2, head)
    }
  } else if (g.kind === 'polyline') {
    if (g.points.length < 2) {
      ctx.restore()
      return
    }
    ctx.beginPath()
    ctx.moveTo(g.points[0]!.x, g.points[0]!.y)
    for (let i = 1; i < g.points.length; i++) ctx.lineTo(g.points[i]!.x, g.points[i]!.y)
    ctx.stroke()
  } else if (g.kind === 'polygon') {
    if (g.points.length < 3) {
      ctx.restore()
      return
    }
    ctx.beginPath()
    ctx.moveTo(g.points[0]!.x, g.points[0]!.y)
    for (let i = 1; i < g.points.length; i++) ctx.lineTo(g.points[i]!.x, g.points[i]!.y)
    ctx.closePath()
    if (node.fill !== 'none') {
      ctx.fillStyle = node.fill
      ctx.fill()
    }
    ctx.stroke()
  } else if (g.kind === 'path') {
    const p = new Path2D(g.d)
    if (node.fill !== 'none') {
      ctx.fillStyle = node.fill
      ctx.fill(p)
    }
    ctx.stroke(p)
  }
  ctx.restore()
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 120, 255, 0.85)'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.strokeRect(node.x + 0.5, node.y + 0.5, node.width, node.height)
  ctx.strokeStyle = 'rgba(255, 40, 40, 0.85)'
  ctx.strokeRect(node.x + node.ink.x + 0.5, node.y + node.ink.y + 0.5, node.ink.width, node.ink.height)
  ctx.restore()
}

function paintOrder(children: LayoutNode[]): LayoutNode[] {
  return children
    .map((node, index) => ({ node, index }))
    .sort((a, b) => (a.node.zIndex ?? 0) - (b.node.zIndex ?? 0) || a.index - b.index)
    .map((item) => item.node)
}

function paintClipped(ctx: CanvasRenderingContext2D, node: LayoutNode, draw: () => void) {
  if (node.overflow !== 'hidden') {
    draw()
    return
  }
  ctx.save()
  traceRoundRect(ctx, node.x, node.y, node.width, node.height, nodeRadii(node))
  ctx.clip()
  draw()
  ctx.restore()
}

function paintNode(ctx: CanvasRenderingContext2D, node: LayoutNode, debug: boolean) {
  ctx.save()
  ctx.globalAlpha *= node.opacity
  if (node.rotate !== 0 || node.scale !== 1) {
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((node.rotate * Math.PI) / 180)
    ctx.scale(node.scale, node.scale)
    ctx.translate(-cx, -cy)
  }
  if (node.kind === 'text') {
    drawBoxShadow(ctx, node)
    drawBackground(ctx, node)
    paintClipped(ctx, node, () => drawTextNode(ctx, node))
    drawBorder(ctx, node)
  } else if (node.kind === 'shape') {
    drawBoxShadow(ctx, node)
    drawShape(ctx, node)
    drawBorder(ctx, node)
  } else if (node.kind === 'line') {
    drawLine(ctx, node)
  } else if (node.kind === 'image') {
    drawBoxShadow(ctx, node)
    drawBackground(ctx, node)
    paintClipped(ctx, node, () => drawImageNode(ctx, node))
    drawBorder(ctx, node)
  } else if (node.kind === 'flex' || node.kind === 'layer') {
    drawBoxShadow(ctx, node)
    drawBackground(ctx, node)
    ctx.save()
    ctx.translate(node.x, node.y)
    if (node.overflow === 'hidden') {
      traceRoundRect(ctx, 0, 0, node.width, node.height, nodeRadii(node))
      ctx.clip()
    }
    for (const child of paintOrder(node.children)) paintNode(ctx, child, debug)
    ctx.restore()
    drawBorder(ctx, node)
  }
  if (debug) drawDebugOverlay(ctx, node)
  ctx.restore()
}

export function paintDocument(root: LayerLayoutNode, opts: PaintOptions): Buffer {
  const w = Math.round(opts.width * opts.scale)
  const h = Math.round(opts.height * opts.scale)
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (opts.background !== 'transparent') {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.save()
  ctx.scale(opts.scale, opts.scale)
  for (const child of paintOrder(root.children)) paintNode(ctx, child, opts.debug)
  if (opts.debug) drawDebugOverlay(ctx, root)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

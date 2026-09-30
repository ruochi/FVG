import {
  createCanvas,
  Path2D,
  type Canvas,
  type CanvasRenderingContext2D,
  type ImageData,
} from '@napi-rs/canvas'

type PaintCtx = CanvasRenderingContext2D & {
  canvas: Canvas
  filter: string
  drawImage(...args: unknown[]): void
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData
  putImageData(imageData: ImageData, dx: number, dy: number): void
  createImageData(sw: number, sh: number): ImageData
  getTransform(): { a: number; b: number; c: number; d: number; e: number; f: number }
}
import { buildFontString } from './fonts.js'
import { canvasPaint, isGradient } from './gradient.js'
import { gradientStyle, isGradientPaint, type GradientBox } from './gradientField.js'
import { originOffset } from './matrix.js'
import { colorFilterToCss } from './style.js'
import type {
  GlowSpec,
  LayerLayoutNode,
  LayoutNode,
  LineLayoutNode,
  NoiseSpec,
  ShadowSpec,
  ShapeLayoutNode,
  TextLayoutNode,
} from './types.js'
import type { DrawElSnapshot } from './types.js'

export type PaintOptions = {
  width: number
  height: number
  background: string
  scale: number
  debug: boolean
  t: number
}

type PaintState = { canvasWidth: number; canvasHeight: number }

const SILHOUETTE = '#000000'

function paintOf(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  pad = 0,
) {
  if (isGradientPaint(value)) {
    const box: GradientBox = { x, y, width: w, height: h }
    return gradientStyle(ctx, value, box, pad)
  }
  return canvasPaint(ctx, value, x, y, w, h)
}

function shapePad(node: ShapeLayoutNode): number {
  return node.stroke !== 'none' && node.strokeWidth > 0 ? node.strokeWidth / 2 + 2 : 1
}

function linePad(node: LineLayoutNode): number {
  const stroked = node.stroke !== 'none' && node.strokeWidth > 0
  if (!stroked) return 1
  let pad = node.strokeWidth / 2 + 2
  if (node.geometry.kind === 'arrow') {
    const head = node.geometry.head ?? Math.max(12, node.strokeWidth * 4)
    pad = Math.max(pad, head + 2)
  }
  return pad
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

function drawBoxChrome(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  if (node.background && node.background !== 'transparent') {
    ctx.fillStyle = paintOf(ctx, node.background, node.x, node.y, node.width, node.height)
    if (node.borderRadius && node.borderRadius > 0) {
      roundRectPath(ctx, node.x, node.y, node.width, node.height, node.borderRadius)
      ctx.fill()
    } else {
      ctx.fillRect(node.x, node.y, node.width, node.height)
    }
  }
  if (node.border && node.border.width > 0) {
    ctx.strokeStyle = node.border.color
    ctx.lineWidth = node.border.width
    if (node.borderRadius && node.borderRadius > 0) {
      roundRectPath(ctx, node.x, node.y, node.width, node.height, node.borderRadius)
      ctx.stroke()
    } else {
      ctx.strokeRect(node.x + node.border.width / 2, node.y + node.border.width / 2, node.width - node.border.width, node.height - node.border.width)
    }
  }
}

function drawTextNode(ctx: CanvasRenderingContext2D, node: TextLayoutNode, inkColor?: string) {
  const contentX = node.x + node.padding.left + (node.border?.width ?? 0)
  const contentY = node.y + node.padding.top + (node.border?.width ?? 0)
  for (const line of node.textLayout.lines) {
    let offsetX = 0
    if (node.textAlign === 'center') offsetX = (node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width) / 2
    if (node.textAlign === 'right') offsetX = node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width
    for (const seg of line.segments) {
      ctx.font = buildFontString(seg.style.fontFamily, seg.style.fontWeight, seg.style.fontSize)
      ctx.fillStyle = inkColor ?? seg.style.color
      ctx.letterSpacing = `${seg.style.letterSpacing}px`
      ctx.fillText(seg.text, contentX + offsetX + seg.x, contentY + line.baselineY)
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode) {
  const x = node.x
  const y = node.y
  const pad = shapePad(node)
  if (node.shape === 'rect') {
    const r = node.rx ?? 0
    if (r > 0) {
      roundRectPath(ctx, x, y, node.width, node.height, r)
      if (node.fill !== 'none') {
        ctx.fillStyle = paintOf(ctx, node.fill, node.x, node.y, node.width, node.height, pad)
        ctx.fill()
      }
      if (node.stroke !== 'none') {
        ctx.strokeStyle = paintOf(ctx, node.stroke, node.x, node.y, node.width, node.height, pad)
        ctx.lineWidth = node.strokeWidth
        ctx.stroke()
      }
    } else {
      if (node.fill !== 'none') {
        ctx.fillStyle = paintOf(ctx, node.fill, node.x, node.y, node.width, node.height, pad)
        ctx.fillRect(x, y, node.width, node.height)
      }
      if (node.stroke !== 'none') {
        ctx.strokeStyle = paintOf(ctx, node.stroke, node.x, node.y, node.width, node.height, pad)
        ctx.lineWidth = node.strokeWidth
        ctx.strokeRect(x, y, node.width, node.height)
      }
    }
  } else if (node.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(x + node.width / 2, y + node.height / 2, node.r ?? node.width / 2, 0, Math.PI * 2)
    if (node.fill !== 'none') {
      ctx.fillStyle = paintOf(ctx, node.fill, node.x, node.y, node.width, node.height, pad)
      ctx.fill()
    }
    if (node.stroke !== 'none') {
      ctx.strokeStyle = paintOf(ctx, node.stroke, node.x, node.y, node.width, node.height, pad)
      ctx.lineWidth = node.strokeWidth
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.ellipse(
      x + node.width / 2,
      y + node.height / 2,
      node.rxEllipse ?? node.width / 2,
      node.ry ?? node.height / 2,
      0,
      0,
      Math.PI * 2,
    )
    if (node.fill !== 'none') {
      ctx.fillStyle = paintOf(ctx, node.fill, node.x, node.y, node.width, node.height, pad)
      ctx.fill()
    }
    if (node.stroke !== 'none') {
      ctx.strokeStyle = paintOf(ctx, node.stroke, node.x, node.y, node.width, node.height, pad)
      ctx.lineWidth = node.strokeWidth
      ctx.stroke()
    }
  }
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

function drawLine(ctx: CanvasRenderingContext2D, node: LineLayoutNode, silhouette = false, spread = 0) {
  ctx.save()
  ctx.translate(node.x, node.y)
  const stroked = node.stroke !== 'none' && node.strokeWidth > 0
  const lineWidth = silhouette ? Math.max(0.5, node.strokeWidth + spread * 2) : node.strokeWidth
  const pad = linePad(node)
  if (silhouette) {
    ctx.strokeStyle = SILHOUETTE
    ctx.fillStyle = SILHOUETTE
    ctx.lineWidth = lineWidth
  } else if (stroked) {
    ctx.strokeStyle = paintOf(ctx, node.stroke, 0, 0, node.width, node.height, pad)
    ctx.fillStyle = paintOf(ctx, node.stroke, 0, 0, node.width, node.height, pad)
    ctx.lineWidth = node.strokeWidth
  }
  ctx.lineCap = node.strokeLinecap ?? 'round'
  ctx.lineJoin = node.strokeLinejoin ?? 'round'
  const g = node.geometry
  if (g.kind === 'line' || g.kind === 'arrow') {
    if (!stroked) {
      ctx.restore()
      return
    }
    ctx.beginPath()
    ctx.moveTo(g.x1, g.y1)
    ctx.lineTo(g.x2, g.y2)
    ctx.stroke()
    if (g.kind === 'arrow') {
      const head = g.head ?? Math.max(12, node.strokeWidth * 4)
      drawArrowHead(ctx, g.x1, g.y1, g.x2, g.y2, head)
    }
  } else if (g.kind === 'polyline') {
    if (g.points.length < 2 || !stroked) {
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
      if (!silhouette) ctx.fillStyle = paintOf(ctx, node.fill, 0, 0, node.width, node.height, pad)
      ctx.fill()
    }
    if (stroked) ctx.stroke()
  } else if (g.kind === 'path') {
    const p = new Path2D(g.d)
    if (node.fill !== 'none') {
      if (!silhouette) ctx.fillStyle = paintOf(ctx, node.fill, 0, 0, node.width, node.height, pad)
      ctx.fill(p)
    }
    if (stroked) ctx.stroke(p)
  } else {
    // 未知线条类型
  }
  ctx.restore()
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 120, 255, 0.85)'
  ctx.lineWidth = 1
  ctx.strokeRect(node.x + 0.5, node.y + 0.5, node.width, node.height)
  ctx.strokeStyle = 'rgba(255, 40, 40, 0.85)'
  ctx.strokeRect(node.x + node.ink.x + 0.5, node.y + node.ink.y + 0.5, node.ink.width, node.ink.height)
  ctx.restore()
}

function buildDrawEl(node: LayoutNode, t: number): DrawElSnapshot {
  return {
    tag: node.tag,
    id: node.id,
    text: node.text,
    attr: node.attr,
    style: node.style,
    computed: node.computed,
    w: node.width,
    h: node.height,
    t,
  }
}

function runElementDraw(ctx: CanvasRenderingContext2D, node: LayoutNode, t: number) {
  if (!node.draw) return
  ctx.save()
  ctx.translate(node.x, node.y)
  node.draw(ctx, buildDrawEl(node, t))
  ctx.restore()
}

/** 绕 origin 旋转、缩放。支点用当前坐标系里的绝对位置，子绘制仍使用 node.x/node.y。 */
function applyNodeTransform(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  if (node.rotate === 0 && node.scale === 1) return
  const o = originOffset(node.origin, node.width, node.height)
  const px = node.x + o.x
  const py = node.y + o.y
  ctx.translate(px, py)
  ctx.rotate((node.rotate * Math.PI) / 180)
  ctx.scale(node.scale, node.scale)
  ctx.translate(-px, -py)
}

function drawBoxSilhouette(ctx: CanvasRenderingContext2D, node: LayoutNode, spread: number, ink = SILHOUETTE) {
  const x = node.x - spread
  const y = node.y - spread
  const w = node.width + spread * 2
  const h = node.height + spread * 2
  if (w <= 0 || h <= 0) return
  const radius = Math.max(0, (node.borderRadius ?? 0) + spread)
  ctx.fillStyle = ink
  if (radius > 0) {
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.fill()
  } else ctx.fillRect(x, y, w, h)
}

function drawShapeSilhouette(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode, spread: number, ink = SILHOUETTE) {
  ctx.fillStyle = ink
  if (node.shape === 'rect') {
    const x = node.x - spread
    const y = node.y - spread
    const w = node.width + spread * 2
    const h = node.height + spread * 2
    if (w <= 0 || h <= 0) return
    const radius = Math.max(0, (node.rx ?? node.borderRadius ?? 0) + spread)
    if (radius > 0) {
      roundRectPath(ctx, x, y, w, h, radius)
      ctx.fill()
    } else ctx.fillRect(x, y, w, h)
    return
  }
  if (node.shape === 'circle') {
    const radius = (node.r ?? node.width / 2) + spread
    if (radius <= 0) return
    ctx.beginPath()
    ctx.arc(node.x + node.width / 2, node.y + node.height / 2, radius, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const rx = (node.rxEllipse ?? node.width / 2) + spread
  const ry = (node.ry ?? node.height / 2) + spread
  if (rx <= 0 || ry <= 0) return
  ctx.beginPath()
  ctx.ellipse(node.x + node.width / 2, node.y + node.height / 2, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawEffect(
  ctx: CanvasRenderingContext2D,
  state: PaintState,
  node: LayoutNode,
  effect: { dx: number; dy: number; blur: number; spread: number; color: string },
  drawSilhouette: (spread: number) => void,
  blend: 'source-over' | 'screen' = 'source-over',
) {
  const matrix = (ctx as CanvasRenderingContext2D & { getTransform(): { a: number; b: number; c: number; d: number; e: number; f: number } }).getTransform()
  const k = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1
  const devX = matrix.a * effect.dx + matrix.c * effect.dy
  const devY = matrix.b * effect.dx + matrix.d * effect.dy
  const far =
    2 * (state.canvasWidth + state.canvasHeight) +
    4 * k * (node.width + node.height + Math.abs(effect.spread) + effect.blur) +
    Math.abs(devX)
  ctx.save()
  ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - far, matrix.f)
  ctx.globalCompositeOperation = blend
  ctx.shadowColor = effect.color
  ctx.shadowBlur = effect.blur * k
  ctx.shadowOffsetX = devX + far
  ctx.shadowOffsetY = devY
  drawSilhouette(effect.spread)
  ctx.restore()
}

function shadowEffect(shadow: ShadowSpec) {
  return { dx: shadow.x, dy: shadow.y, blur: shadow.blur, spread: shadow.spread, color: shadow.color }
}

function paintGlow(ctx: CanvasRenderingContext2D, state: PaintState, node: LayoutNode, glow: GlowSpec, drawSilhouette: (spread: number) => void) {
  const wide = { dx: 0, dy: 0, blur: glow.blur, spread: glow.spread, color: glow.color }
  drawEffect(ctx, state, node, wide, drawSilhouette, 'screen')
  drawEffect(ctx, state, node, { ...wide, blur: Math.max(2, glow.blur * 0.35) }, drawSilhouette, 'screen')
}

function drawNodeSilhouette(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  spread: number,
  glyphs: boolean,
  ink = SILHOUETTE,
) {
  if (node.kind === 'line') drawLine(ctx, node, true, spread)
  else if (node.kind === 'shape') drawShapeSilhouette(ctx, node, spread, ink)
  else if (node.kind === 'text' && glyphs) drawTextNode(ctx, node, ink)
  else drawBoxSilhouette(ctx, node, spread, ink)
}

function transformScale(ctx: CanvasRenderingContext2D): number {
  const matrix = (
    ctx as CanvasRenderingContext2D & { getTransform(): { a: number; b: number; c: number; d: number } }
  ).getTransform()
  return Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1
}

function clipToNode(ctx: CanvasRenderingContext2D, node: LayoutNode) {
  ctx.beginPath()
  if (node.kind === 'shape') {
    if (node.shape === 'circle') {
      ctx.arc(node.x + node.width / 2, node.y + node.height / 2, node.r ?? node.width / 2, 0, Math.PI * 2)
    } else if (node.shape === 'ellipse') {
      ctx.ellipse(
        node.x + node.width / 2,
        node.y + node.height / 2,
        node.rxEllipse ?? node.width / 2,
        node.ry ?? node.height / 2,
        0,
        0,
        Math.PI * 2,
      )
    } else if (node.borderRadius && node.borderRadius > 0) {
      roundRectPath(ctx, node.x, node.y, node.width, node.height, node.borderRadius)
    } else if (node.rx && node.rx > 0) {
      roundRectPath(ctx, node.x, node.y, node.width, node.height, node.rx)
    } else {
      ctx.rect(node.x, node.y, node.width, node.height)
    }
  } else if (node.borderRadius && node.borderRadius > 0) {
    roundRectPath(ctx, node.x, node.y, node.width, node.height, node.borderRadius)
  } else {
    ctx.rect(node.x, node.y, node.width, node.height)
  }
  ctx.clip()
}

function paintInnerEffect(
  ctx: PaintCtx,
  node: LayoutNode,
  effect: { x: number; y: number; blur: number; spread: number; color: string },
  blend: 'source-over' | 'screen',
  glyphs: boolean,
) {
  if (node.width <= 0 || node.height <= 0) return
  const k = transformScale(ctx)
  const pad = Math.ceil(effect.blur * 2 + Math.abs(effect.spread) + Math.abs(effect.x) + Math.abs(effect.y) + 4)
  const twLogic = Math.max(1, Math.ceil(node.width + pad * 2))
  const thLogic = Math.max(1, Math.ceil(node.height + pad * 2))
  const tw = Math.max(1, Math.ceil(twLogic * k))
  const th = Math.max(1, Math.ceil(thLogic * k))

  const fill = createCanvas(tw, th)
  const fctx = fill.getContext('2d') as PaintCtx
  fctx.setTransform(k, 0, 0, k, 0, 0)
  fctx.translate(-node.x + pad, -node.y + pad)
  drawNodeSilhouette(fctx, node, Math.max(0, effect.spread), glyphs, effect.color)

  const cut = createCanvas(tw, th)
  const cctx = cut.getContext('2d') as PaintCtx
  cctx.setTransform(k, 0, 0, k, 0, 0)
  cctx.translate(-node.x + pad, -node.y + pad)
  drawNodeSilhouette(cctx, node, -Math.max(0, effect.spread), glyphs, '#000000')

  const cutSoft = createCanvas(tw, th)
  const sctx = cutSoft.getContext('2d') as PaintCtx
  if (effect.blur > 0) sctx.filter = `blur(${effect.blur * k}px)`
  // 反向偏移：正 y 的内阴影落在底部内侧
  sctx.drawImage(cut, -effect.x * k, -effect.y * k)
  sctx.filter = 'none'

  fctx.setTransform(1, 0, 0, 1, 0, 0)
  fctx.globalCompositeOperation = 'destination-out'
  fctx.drawImage(cutSoft, 0, 0)

  ctx.save()
  clipToNode(ctx, node)
  ctx.globalCompositeOperation = blend
  ctx.drawImage(fill, node.x - pad, node.y - pad, twLogic, thLogic)
  ctx.restore()
}

function paintNoise(ctx: PaintCtx, node: LayoutNode, noise: NoiseSpec) {
  const w = Math.max(1, Math.ceil(node.width))
  const h = Math.max(1, Math.ceil(node.height))
  if (node.width <= 0 || node.height <= 0 || noise.amount <= 0) return
  const off = createCanvas(w, h)
  const octx = off.getContext('2d') as PaintCtx
  const img = octx.createImageData(w, h)
  const data = img.data
  let colorR = 255
  let colorG = 255
  let colorB = 255
  if (noise.color) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(noise.color.trim())
    if (m) {
      const hex = m[1]!
      if (hex.length === 3) {
        colorR = Number.parseInt(hex[0]! + hex[0]!, 16)
        colorG = Number.parseInt(hex[1]! + hex[1]!, 16)
        colorB = Number.parseInt(hex[2]! + hex[2]!, 16)
      } else {
        colorR = Number.parseInt(hex.slice(0, 2), 16)
        colorG = Number.parseInt(hex.slice(2, 4), 16)
        colorB = Number.parseInt(hex.slice(4, 6), 16)
      }
    }
  }
  // 确定性噪点：同一输入同一纹理
  let seed = (Math.floor(node.x) * 73856093) ^ (Math.floor(node.y) * 19349663) ^ (w * 83492791) ^ (h * 39916801)
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  for (let i = 0; i < data.length; i += 4) {
    const n = next()
    data[i] = Math.round(colorR * n)
    data[i + 1] = Math.round(colorG * n)
    data[i + 2] = Math.round(colorB * n)
    data[i + 3] = Math.round(255 * noise.amount)
  }
  octx.putImageData(img, 0, 0)
  ctx.save()
  clipToNode(ctx, node)
  ctx.globalCompositeOperation = 'soft-light'
  ctx.drawImage(off, node.x, node.y, node.width, node.height)
  ctx.restore()
}

function paintBackdropBlur(ctx: PaintCtx, node: LayoutNode, radius: number) {
  if (radius <= 0 || node.width <= 0 || node.height <= 0) return
  const matrix = ctx.getTransform()
  const corners = [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y },
    { x: node.x, y: node.y + node.height },
    { x: node.x + node.width, y: node.y + node.height },
  ].map((p) => ({
    x: matrix.a * p.x + matrix.c * p.y + matrix.e,
    y: matrix.b * p.x + matrix.d * p.y + matrix.f,
  }))
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x))))
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))))
  const maxX = Math.min(ctx.canvas.width, Math.ceil(Math.max(...corners.map((p) => p.x))))
  const maxY = Math.min(ctx.canvas.height, Math.ceil(Math.max(...corners.map((p) => p.y))))
  const sw = maxX - minX
  const sh = maxY - minY
  if (sw <= 0 || sh <= 0) return
  const snapshot = ctx.getImageData(minX, minY, sw, sh)
  const src = createCanvas(sw, sh)
  ;(src.getContext('2d') as PaintCtx).putImageData(snapshot, 0, 0)
  const blurred = createCanvas(sw, sh)
  const bctx = blurred.getContext('2d') as PaintCtx
  const k = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1
  bctx.filter = `blur(${radius * k}px)`
  bctx.drawImage(src, 0, 0)
  bctx.filter = 'none'
  ctx.save()
  clipToNode(ctx, node)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(blurred, minX, minY)
  ctx.restore()
}

function paintBody(ctx: PaintCtx, node: LayoutNode, debug: boolean, t: number, state: PaintState) {
  if (node.kind === 'text') {
    drawBoxChrome(ctx, node)
    drawTextNode(ctx, node)
  } else if (node.kind === 'shape') {
    drawShape(ctx, node)
  } else if (node.kind === 'line') {
    drawLine(ctx, node)
  } else if (node.kind === 'custom') {
    drawBoxChrome(ctx, node)
  } else if (node.kind === 'flex' || node.kind === 'layer') {
    drawBoxChrome(ctx, node)
    ctx.save()
    const inset = node.kind === 'flex' ? node.padding.left + (node.border?.width ?? 0) : 0
    const insetY = node.kind === 'flex' ? node.padding.top + (node.border?.width ?? 0) : 0
    ctx.translate(node.x + inset, node.y + insetY)
    if (node.kind === 'layer' && node.overflow === 'hidden') {
      ctx.beginPath()
      ctx.rect(0, 0, node.width, node.height)
      ctx.clip()
    }
    for (const ch of node.children) paintNode(ctx, ch, debug, t, state)
    ctx.restore()
  }
}

function paintNodeEffectsAndBody(
  ctx: PaintCtx,
  node: LayoutNode,
  debug: boolean,
  t: number,
  state: PaintState,
  opts: { backdrop: boolean },
) {
  if (opts.backdrop && node.backdropBlur) paintBackdropBlur(ctx, node, node.backdropBlur)
  if (node.shadow) {
    drawEffect(ctx, state, node, shadowEffect(node.shadow), (spread) => drawNodeSilhouette(ctx, node, spread, false))
  }
  if (node.glow) paintGlow(ctx, state, node, node.glow, (spread) => drawNodeSilhouette(ctx, node, spread, true))
  paintBody(ctx, node, debug, t, state)
  if (node.innerShadow) {
    paintInnerEffect(ctx, node, node.innerShadow, 'source-over', node.kind === 'text')
  }
  if (node.innerGlow) {
    paintInnerEffect(
      ctx,
      node,
      { x: 0, y: 0, blur: node.innerGlow.blur, spread: node.innerGlow.spread, color: node.innerGlow.color },
      'screen',
      node.kind === 'text',
    )
    paintInnerEffect(
      ctx,
      node,
      {
        x: 0,
        y: 0,
        blur: Math.max(2, node.innerGlow.blur * 0.35),
        spread: node.innerGlow.spread,
        color: node.innerGlow.color,
      },
      'screen',
      node.kind === 'text',
    )
  }
  if (node.noise) paintNoise(ctx, node, node.noise)
  runElementDraw(ctx, node, t)
}

function paintWithLayerFilter(ctx: PaintCtx, node: LayoutNode, debug: boolean, t: number, state: PaintState) {
  const blur = node.blur ?? 0
  const filterCss = node.colorFilter?.length ? colorFilterToCss(node.colorFilter) : ''
  const pad = Math.ceil(blur * 2 + 4)
  const shadowPad = node.shadow
    ? node.shadow.blur * 2 + node.shadow.spread + Math.max(Math.abs(node.shadow.x), Math.abs(node.shadow.y))
    : 0
  const glowPad = node.glow ? node.glow.blur * 2 + node.glow.spread : 0
  const effectPad = Math.max(pad, Math.ceil(shadowPad), Math.ceil(glowPad))
  const tw = Math.max(1, Math.ceil(node.width + effectPad * 2))
  const th = Math.max(1, Math.ceil(node.height + effectPad * 2))
  const k = transformScale(ctx)
  const off = createCanvas(Math.max(1, Math.ceil(tw * k)), Math.max(1, Math.ceil(th * k)))
  const octx = off.getContext('2d') as PaintCtx
  octx.setTransform(k, 0, 0, k, 0, 0)
  octx.translate(-node.x + effectPad, -node.y + effectPad)
  paintNodeEffectsAndBody(octx, node, debug, t, state, { backdrop: false })
  const parts: string[] = []
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (filterCss) parts.push(filterCss)
  ctx.save()
  ctx.filter = parts.join(' ') || 'none'
  ctx.drawImage(off, node.x - effectPad, node.y - effectPad, tw, th)
  ctx.filter = 'none'
  ctx.restore()
}

function paintNode(ctx: CanvasRenderingContext2D, node: LayoutNode, debug: boolean, t: number, state: PaintState) {
  const pctx = ctx as PaintCtx
  pctx.save()
  pctx.globalAlpha *= node.opacity
  applyNodeTransform(pctx, node)
  if (node.blend && node.blend !== 'source-over') {
    pctx.globalCompositeOperation = node.blend
  }
  const useLayerFilter = (node.blur != null && node.blur > 0) || (node.colorFilter != null && node.colorFilter.length > 0)
  if (node.backdropBlur) paintBackdropBlur(pctx, node, node.backdropBlur)
  if (useLayerFilter) paintWithLayerFilter(pctx, node, debug, t, state)
  else paintNodeEffectsAndBody(pctx, node, debug, t, state, { backdrop: false })
  if (debug) drawDebugOverlay(pctx, node)
  pctx.restore()
}

export function paintDocument(
  root: LayerLayoutNode,
  opts: PaintOptions,
): Buffer {
  const w = Math.round(opts.width * opts.scale)
  const h = Math.round(opts.height * opts.scale)
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const state = { canvasWidth: w, canvasHeight: h }
  const rootPaintsBackground =
    root.background != null &&
    root.background !== 'transparent' &&
    root.x === 0 &&
    root.y === 0 &&
    root.width >= opts.width &&
    root.height >= opts.height
  if (!rootPaintsBackground && opts.background !== 'transparent') {
    if (isGradient(opts.background)) {
      ctx.save()
      ctx.scale(opts.scale, opts.scale)
      ctx.fillStyle = paintOf(ctx, opts.background, 0, 0, opts.width, opts.height)
      ctx.fillRect(0, 0, opts.width, opts.height)
      ctx.restore()
    } else {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, w, h)
    }
  }
  ctx.save()
  ctx.scale(opts.scale, opts.scale)
  paintNode(ctx, root, opts.debug, opts.t, state)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

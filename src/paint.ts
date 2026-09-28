import { createCanvas, Path2D, type SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas'
import { buildFontString } from './fonts.js'
import type {
  GlowSpec,
  LayerLayoutNode,
  LayoutNode,
  LineLayoutNode,
  ShadowSpec,
  ShapeLayoutNode,
  TextLayoutNode,
} from './types.js'

export type PaintOptions = {
  width: number
  height: number
  background: string
  scale: number
  debug: boolean
}

type PaintState = {
  debug: boolean
  canvasWidth: number
  canvasHeight: number
}

/** 剪影用的颜色；真正的颜色来自 shadowColor */
const SILHOUETTE = '#000000'

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
    ctx.fillStyle = node.background
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

/** silhouetteSpread 有值时只画剪影：字形用当前 fillStyle，并按 spread 描边外扩 */
function drawTextNode(ctx: CanvasRenderingContext2D, node: TextLayoutNode, silhouetteSpread?: number) {
  const contentX = node.x + node.padding.left + (node.border?.width ?? 0)
  const contentY = node.y + node.padding.top + (node.border?.width ?? 0)
  const innerW = node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2
  const spread = Math.max(0, silhouetteSpread ?? 0)
  for (const line of node.textLayout.lines) {
    let offsetX = 0
    if (node.textAlign === 'center') offsetX = (innerW - line.width) / 2
    if (node.textAlign === 'right') offsetX = innerW - line.width
    for (const seg of line.segments) {
      ctx.font = buildFontString(seg.style.fontFamily, seg.style.fontWeight, seg.style.fontSize)
      ctx.letterSpacing = `${seg.style.letterSpacing}px`
      const x = contentX + offsetX + seg.x
      const y = contentY + line.baselineY
      if (silhouetteSpread == null) ctx.fillStyle = seg.style.color
      ctx.fillText(seg.text, x, y)
      if (spread > 0) {
        ctx.lineWidth = spread * 2
        ctx.lineJoin = 'round'
        ctx.strokeText(seg.text, x, y)
      }
    }
  }
}

/** 形状外轮廓按 grow 外扩后的路径 */
function shapePath(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode, grow: number) {
  const cx = node.width / 2
  const cy = node.height / 2
  ctx.beginPath()
  if (node.shape === 'rect') {
    const w = node.width + grow * 2
    const h = node.height + grow * 2
    if (w <= 0 || h <= 0) return
    const r = node.rx ?? 0
    if (r > 0) roundRectPath(ctx, -grow, -grow, w, h, Math.max(0, r + grow))
    else ctx.rect(-grow, -grow, w, h)
  } else if (node.shape === 'circle') {
    ctx.arc(cx, cy, Math.max(0, (node.r ?? cx) + grow), 0, Math.PI * 2)
  } else {
    const rx = Math.max(0, (node.rxEllipse ?? cx) + grow)
    const ry = Math.max(0, (node.ry ?? cy) + grow)
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode) {
  shapePath(ctx, node, 0)
  if (node.fill !== 'none') {
    ctx.fillStyle = node.fill
    ctx.fill()
  }
  if (node.stroke !== 'none') {
    ctx.strokeStyle = node.stroke
    ctx.lineWidth = node.strokeWidth
    if (node.dash) ctx.setLineDash(node.dash)
    ctx.stroke()
  }
}

function drawShapeSilhouette(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode, spread: number) {
  const hasStroke = node.stroke !== 'none'
  if (node.fill !== 'none') {
    shapePath(ctx, node, spread + (hasStroke ? node.strokeWidth / 2 : 0))
    ctx.fill()
  } else if (hasStroke) {
    const width = node.strokeWidth + spread * 2
    if (width <= 0) return
    shapePath(ctx, node, 0)
    ctx.lineWidth = width
    if (node.dash) ctx.setLineDash(node.dash)
    ctx.stroke()
  }
}

function withShapeTransform(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode, draw: () => void) {
  ctx.save()
  ctx.translate(node.width / 2, node.height / 2)
  ctx.rotate((node.rotate * Math.PI) / 180)
  ctx.scale(node.scale, node.scale)
  ctx.translate(-node.width / 2, -node.height / 2)
  draw()
  ctx.restore()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, head: number, grow: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
  if (grow > 0) {
    ctx.save()
    ctx.setLineDash([])
    ctx.lineWidth = grow * 2
    ctx.stroke()
    ctx.restore()
  }
}

/** silhouetteSpread 有值时只画剪影：沿用当前颜色，线宽加粗 2 × spread */
function drawLine(ctx: CanvasRenderingContext2D, node: LineLayoutNode, silhouetteSpread?: number) {
  const silhouette = silhouetteSpread != null
  const grow = Math.max(0, silhouetteSpread ?? 0)
  ctx.save()
  ctx.translate(node.x, node.y)
  if (!silhouette) {
    ctx.strokeStyle = node.stroke
    ctx.fillStyle = node.stroke
  }
  ctx.lineWidth = node.strokeWidth + grow * 2
  ctx.lineCap = node.strokeLinecap ?? 'round'
  ctx.lineJoin = node.strokeLinejoin ?? 'round'
  if (node.dash) ctx.setLineDash(node.dash)
  const fillShape = (path?: Path2D) => {
    if (node.fill === 'none') return
    if (!silhouette) ctx.fillStyle = node.fill
    if (path) ctx.fill(path)
    else ctx.fill()
  }
  const g = node.geometry
  if (g.kind === 'line' || g.kind === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(g.x1, g.y1)
    ctx.lineTo(g.x2, g.y2)
    ctx.stroke()
    if (g.kind === 'arrow') {
      const head = g.head ?? Math.max(12, node.strokeWidth * 4)
      drawArrowHead(ctx, g.x1, g.y1, g.x2, g.y2, head, grow)
    }
  } else if (g.kind === 'polyline' || g.kind === 'polygon') {
    const closed = g.kind === 'polygon'
    if (g.points.length >= (closed ? 3 : 2)) {
      ctx.beginPath()
      ctx.moveTo(g.points[0]!.x, g.points[0]!.y)
      for (let i = 1; i < g.points.length; i++) ctx.lineTo(g.points[i]!.x, g.points[i]!.y)
      if (closed) {
        ctx.closePath()
        fillShape()
      }
      ctx.stroke()
    }
  } else if (g.kind === 'path') {
    const p = new Path2D(g.d)
    ctx.translate(g.offsetX ?? 0, g.offsetY ?? 0)
    fillShape(p)
    ctx.stroke(p)
  }
  ctx.restore()
}

function drawBoxSilhouette(ctx: CanvasRenderingContext2D, node: LayoutNode, spread: number) {
  const w = node.width + spread * 2
  const h = node.height + spread * 2
  if (w <= 0 || h <= 0) return
  const r = node.borderRadius ?? 0
  if (r > 0) {
    roundRectPath(ctx, -spread, -spread, w, h, Math.max(0, r + spread))
    ctx.fill()
  } else {
    ctx.fillRect(-spread, -spread, w, h)
  }
}

/**
 * 用画布原生阴影画效果：剪影在设备坐标里移到画面外，阴影再用 offset 移回来，
 * 所以只留下模糊后的那一层。偏移按当前变换换算，跟着旋转、缩放和导出倍率走。
 */
function drawEffect(
  ctx: CanvasRenderingContext2D,
  state: PaintState,
  node: LayoutNode,
  effect: { dx: number; dy: number; blur: number; spread: number; color: string },
  drawSilhouette: (spread: number) => void,
  blend: 'source-over' | 'screen' = 'source-over',
) {
  const m = ctx.getTransform()
  const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))
  const devX = m.a * effect.dx + m.c * effect.dy
  const devY = m.b * effect.dx + m.d * effect.dy
  const far =
    2 * (state.canvasWidth + state.canvasHeight) +
    4 * k * (node.width + node.height + Math.abs(effect.spread) + effect.blur) +
    Math.abs(devX)
  if (process.env.FVG_GLOW_LOG && (node.tag === 'Path' || node.tag === 'Circle')) {
    console.log(
      '[glow] tag=%s blend=%s blur=%s spread=%s color=%s dx=%s dy=%s k=%s far=%s shadowBlur=%s offset=%s,%s box=%sx%s',
      node.tag,
      blend,
      effect.blur,
      effect.spread,
      effect.color,
      effect.dx,
      effect.dy,
      k.toFixed(3),
      Math.round(far),
      effect.blur * k,
      Math.round(devX + far),
      Math.round(devY),
      Math.round(node.width),
      Math.round(node.height),
    )
  }
  ctx.save()
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e - far, m.f)
  ctx.globalCompositeOperation = blend
  ctx.shadowColor = effect.color
  ctx.shadowBlur = effect.blur * k
  ctx.shadowOffsetX = devX + far
  ctx.shadowOffsetY = devY
  ctx.fillStyle = SILHOUETTE
  ctx.strokeStyle = SILHOUETTE
  drawSilhouette(effect.spread)
  ctx.restore()
}

function shadowEffect(s: ShadowSpec) {
  return { dx: s.x, dy: s.y, blur: s.blur, spread: s.spread, color: s.color }
}

function glowEffect(g: GlowSpec) {
  return { dx: 0, dy: 0, blur: g.blur, spread: g.spread, color: g.color }
}

/**
 * 光晕最亮的部分压在本体下面，露出来的只是模糊的尾巴，叠在深色上几乎看不见。
 * 用 screen 加光，再补一圈更紧的模糊，让本体外面有一圈能看出来的亮边。
 */
function paintGlow(
  ctx: CanvasRenderingContext2D,
  state: PaintState,
  node: LayoutNode,
  glow: GlowSpec,
  drawSilhouette: (spread: number) => void,
) {
  const wide = glowEffect(glow)
  drawEffect(ctx, state, node, wide, drawSilhouette, 'screen')
  drawEffect(
    ctx,
    state,
    node,
    { ...wide, blur: Math.max(2, glow.blur * 0.35) },
    drawSilhouette,
    'screen',
  )
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

/** 先阴影、再光晕、最后本体 */
function paintNode(ctx: CanvasRenderingContext2D, node: LayoutNode, state: PaintState) {
  ctx.save()
  ctx.translate(node.x, node.y)
  ctx.globalAlpha *= node.opacity
  const local = { ...node, x: 0, y: 0 } as LayoutNode
  if (local.kind === 'text') {
    if (local.shadow) drawEffect(ctx, state, local, shadowEffect(local.shadow), (s) => drawBoxSilhouette(ctx, local, s))
    if (local.glow) paintGlow(ctx, state, local, local.glow, (s) => drawTextNode(ctx, local, s))
    drawBoxChrome(ctx, local)
    drawTextNode(ctx, local)
  } else if (local.kind === 'shape') {
    withShapeTransform(ctx, local, () => {
      if (local.shadow) drawEffect(ctx, state, local, shadowEffect(local.shadow), (s) => drawShapeSilhouette(ctx, local, s))
      if (local.glow) paintGlow(ctx, state, local, local.glow, (s) => drawShapeSilhouette(ctx, local, s))
      drawShape(ctx, local)
    })
  } else if (local.kind === 'line') {
    if (local.shadow) drawEffect(ctx, state, local, shadowEffect(local.shadow), (s) => drawLine(ctx, local, s))
    if (local.glow) paintGlow(ctx, state, local, local.glow, (s) => drawLine(ctx, local, s))
    drawLine(ctx, local)
  } else if (local.kind === 'flex' || local.kind === 'layer') {
    if (local.shadow) drawEffect(ctx, state, local, shadowEffect(local.shadow), (s) => drawBoxSilhouette(ctx, local, s))
    if (local.glow) paintGlow(ctx, state, local, local.glow, (s) => drawBoxSilhouette(ctx, local, s))
    drawBoxChrome(ctx, local)
    for (const ch of local.children) paintNode(ctx, ch, state)
  }
  if (state.debug) drawDebugOverlay(ctx, local)
  ctx.restore()
}

export function paintDocument(
  root: LayerLayoutNode,
  opts: PaintOptions,
): Buffer {
  const w = Math.round(opts.width * opts.scale)
  const h = Math.round(opts.height * opts.scale)
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (opts.background !== 'transparent') {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, w, h)
  }
  const state: PaintState = { debug: opts.debug, canvasWidth: w, canvasHeight: h }
  ctx.save()
  ctx.scale(opts.scale, opts.scale)
  for (const ch of root.children) paintNode(ctx, ch, state)
  if (opts.debug) drawDebugOverlay(ctx, root)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

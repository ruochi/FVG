import { createCanvas, Path2D, type CanvasRenderingContext2D } from '@napi-rs/canvas'
import { buildFontString } from './fonts.js'
import type {
  FlexLayoutNode,
  LayerLayoutNode,
  LayoutNode,
  LineLayoutNode,
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

function drawTextNode(ctx: CanvasRenderingContext2D, node: TextLayoutNode) {
  const contentX = node.x + node.padding.left + (node.border?.width ?? 0)
  const contentY = node.y + node.padding.top + (node.border?.width ?? 0)
  for (const line of node.textLayout.lines) {
    let offsetX = 0
    if (node.textAlign === 'center') offsetX = (node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width) / 2
    if (node.textAlign === 'right') offsetX = node.width - node.padding.left - node.padding.right - (node.border?.width ?? 0) * 2 - line.width
    for (const seg of line.segments) {
      ctx.font = buildFontString(seg.style.fontFamily, seg.style.fontWeight, seg.style.fontSize)
      ctx.fillStyle = seg.style.color
      ctx.letterSpacing = `${seg.style.letterSpacing}px`
      ctx.fillText(seg.text, contentX + offsetX + seg.x, contentY + line.baselineY)
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: ShapeLayoutNode) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((node.rotate * Math.PI) / 180)
  ctx.scale(node.scale, node.scale)
  ctx.translate(-node.width / 2, -node.height / 2)
  if (node.shape === 'rect') {
    const r = node.rx ?? 0
    if (r > 0) {
      roundRectPath(ctx, 0, 0, node.width, node.height, r)
      if (node.fill !== 'none') {
        ctx.fillStyle = node.fill
        ctx.fill()
      }
      if (node.stroke !== 'none') {
        ctx.strokeStyle = node.stroke
        ctx.lineWidth = node.strokeWidth
        ctx.stroke()
      }
    } else {
      if (node.fill !== 'none') {
        ctx.fillStyle = node.fill
        ctx.fillRect(0, 0, node.width, node.height)
      }
      if (node.stroke !== 'none') {
        ctx.strokeStyle = node.stroke
        ctx.lineWidth = node.strokeWidth
        ctx.strokeRect(0, 0, node.width, node.height)
      }
    }
  } else if (node.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(node.width / 2, node.height / 2, node.r ?? node.width / 2, 0, Math.PI * 2)
    if (node.fill !== 'none') {
      ctx.fillStyle = node.fill
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
    if (node.fill !== 'none') {
      ctx.fillStyle = node.fill
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
  const stroked = node.stroke !== 'none' && node.strokeWidth > 0
  if (stroked) {
    ctx.strokeStyle = node.stroke
    ctx.fillStyle = node.stroke
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
      ctx.fillStyle = node.fill
      ctx.fill()
    }
    if (stroked) ctx.stroke()
  } else if (g.kind === 'path') {
    const p = new Path2D(g.d)
    if (node.fill !== 'none') {
      ctx.fillStyle = node.fill
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
  const cx = node.width / 2
  const cy = node.height / 2
  ctx.translate(cx, cy)
  ctx.rotate((node.rotate * Math.PI) / 180)
  ctx.scale(node.scale, node.scale)
  ctx.translate(-cx, -cy)
  node.draw(ctx, buildDrawEl(node, t))
  ctx.restore()
}

function paintNode(ctx: CanvasRenderingContext2D, node: LayoutNode, debug: boolean, t: number) {
  ctx.save()
  ctx.globalAlpha *= node.opacity
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
    for (const ch of node.children) paintNode(ctx, ch, debug, t)
    ctx.restore()
  }
  runElementDraw(ctx, node, t)
  if (debug) drawDebugOverlay(ctx, node)
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
  ctx.save()
  ctx.scale(opts.scale, opts.scale)
  for (const ch of root.children) paintNode(ctx, ch, opts.debug, opts.t)
  if (opts.debug) drawDebugOverlay(ctx, root)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

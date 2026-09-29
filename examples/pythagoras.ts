import type { CanvasRenderingContext2D } from '@napi-rs/canvas'
import {
  h,
  interpolate,
  sequence,
  spring,
  type Composition,
  type DrawElSnapshot,
  type FrameInput,
} from '../src/index.js'

const W = 1280
const H = 720
const FPS = 24
const DURATION = FPS * 8

const BG = '#10141c'
const INK = '#f4f1ea'
const MUTED = '#b7c0cc'
const GOU = '#3ecfc4'
const GU = '#7aa2ff'
const XIAN = '#f5c16c'

function n(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amount: number) {
  const p = Math.min(1, Math.max(0, amount))
  if (p <= 0) return
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p)
  ctx.stroke()
}

function square(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ox: number,
  oy: number,
  amount: number,
  fill: string,
) {
  const p = Math.min(1, Math.max(0, amount))
  if (p <= 0) return
  const dx = ox * p
  const dy = oy * p
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x1 + dx, y1 + dy)
  ctx.lineTo(x0 + dx, y0 + dy)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.globalAlpha = 0.28 * p
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = fill
  ctx.lineWidth = 3
  ctx.stroke()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number) {
  ctx.fillStyle = color
  ctx.font = `700 ${size}px ChillDuanSans`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** 3-4-5 直角三角形，以及勾、股、弦上的正方形。坐标在图块内部。 */
function drawFigure(ctx: CanvasRenderingContext2D, el: DrawElSnapshot) {
  const tri = Number(el.attr.tri)
  const squares = Number(el.attr.squares)
  const showNumbers = Number(el.attr.numbers)

  const p0 = { x: 250, y: 400 }
  const p1 = { x: 442, y: 400 }
  const p2 = { x: 250, y: 256 }
  const aSeg = Math.min(1, tri * 3)
  const bSeg = Math.min(1, tri * 3 - 1)
  const cSeg = Math.min(1, tri * 3 - 2)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = GOU
  ctx.lineWidth = 8
  line(ctx, p0.x, p0.y, p2.x, p2.y, aSeg)

  ctx.strokeStyle = GU
  line(ctx, p0.x, p0.y, p1.x, p1.y, bSeg)

  ctx.strokeStyle = XIAN
  line(ctx, p2.x, p2.y, p1.x, p1.y, cSeg)

  if (aSeg > 0.85) {
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.strokeRect(p0.x, p0.y - 22, 22, 22)
  }

  square(ctx, p2.x, p2.y, p0.x, p0.y, -144, 0, squares, GOU)
  square(ctx, p0.x, p0.y, p1.x, p1.y, 0, 192, squares, GU)
  square(ctx, p2.x, p2.y, p1.x, p1.y, 144, -192, squares, XIAN)

  if (aSeg > 0.4) label(ctx, '勾 a', 292, 300, GOU, 26)
  if (bSeg > 0.4) label(ctx, '股 b', 330, 348, GU, 26)
  if (cSeg > 0.4) label(ctx, '弦 c', 390, 292, XIAN, 26)

  if (showNumbers > 0) {
    ctx.globalAlpha = showNumbers
    label(ctx, '3² = 9', 178, 328, GOU, 26)
    label(ctx, '4² = 16', 346, 496, GU, 26)
    label(ctx, '5² = 25', 430, 232, XIAN, 26)
    ctx.globalAlpha = 1
  }
}

function titleBlock(input: FrameInput) {
  const rise = spring({ frame: input.frame, fps: input.fps, config: { damping: 14, stiffness: 80 } })
  const opacity = interpolate(rise, [0, 1], [0, 1])
  return h(
    'h1',
    {
      cx: '250',
      cy: n(118 - (1 - rise) * 28),
      anchor: 'center',
      opacity: n(opacity),
      style: 'font-size:76px; color:#f4f1ea; text-align:center',
    },
    '勾股定理',
  )
}

function definition(input: FrameInput) {
  return sequence(input, { from: 28, durationInFrames: DURATION - 28 }, (local) => {
    const opacity = interpolate(local.frame, [0, 14], [0, 1])
    return h(
      'p',
      {
        cx: '250',
        cy: '210',
        anchor: 'center',
        opacity: n(opacity),
        style: `width:420px; font-size:32px; color:${MUTED}; text-align:center; line-height:1.45`,
      },
      '直角三角形中，两条直角边的平方和等于斜边的平方',
    )
  })
}

function formula(input: FrameInput) {
  return sequence(input, { from: 52, durationInFrames: DURATION - 52 }, (local) => {
    const opacity = interpolate(local.frame, [0, 12], [0, 1])
    return h(
      'p',
      {
        cx: '250',
        cy: '340',
        anchor: 'center',
        opacity: n(opacity),
        style: 'font-size:54px; color:#f5c16c; text-align:center',
      },
      'a² + b² = c²',
    )
  })
}

function example(input: FrameInput) {
  return sequence(input, { from: 132, durationInFrames: DURATION - 132 }, (local) => {
    const opacity = interpolate(local.frame, [0, 16], [0, 1])
    return h(
      'Column',
      {
        cx: '280',
        cy: '530',
        anchor: 'center',
        opacity: n(opacity),
        style: 'width:460px; gap:16px; align-items:center',
      },
      h('p', { style: `width:460px; font-size:32px; color:${INK}; text-align:center` }, '勾 = 3，股 = 4，弦 = 5'),
      h('p', { style: 'width:460px; font-size:44px; color:#f4f1ea; text-align:center' }, '9 + 16 = 25'),
    )
  })
}

export const pythagoras: Composition = {
  id: 'pythagoras',
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
  component: (input) => {
    const tri = interpolate(input.frame, [36, 108], [0, 1])
    const squares = interpolate(input.frame, [108, 140], [0, 1])
    const numbers = interpolate(input.frame, [140, 160], [0, 1])
    return h(
      'fvg',
      { width: String(W), height: String(H), background: BG, color: INK },
      h(
        'Layer',
        { width: String(W), height: String(H) },
        h('Figure', {
          cx: '930',
          cy: '370',
          anchor: 'center',
          style: 'width:700px; height:640px',
          tri: n(tri),
          squares: n(squares),
          numbers: n(numbers),
          draw: drawFigure,
        }),
        titleBlock(input),
        definition(input),
        formula(input),
        example(input),
      ),
    )
  },
}

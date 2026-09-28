import { createCanvas, type Canvas, type SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas'
import type { ElementReport, FvgDocument, FvgReport, Issue, Rect } from './types.js'

export type DebugIndexMeta = {
  sourceFile: string
  scale: number
}

function pathsWithProblems(issues: Issue[]): Set<string> {
  const out = new Set<string>()
  for (const i of issues) {
    if (i.level === 'error' || i.level === 'warn') out.add(i.path)
  }
  return out
}

const SHEET_BG = '#f6f3ee'
const LABEL_COL = 48
const LABEL_H = 16
const LABEL_GAP = 3
const SHEET_PAD = 10
const SCALE_STRIP = 18
const V_LANE = 58
const H_LANE = 18

export type DebugLabel = {
  n: number
  side: 'left' | 'right'
  x: number
  y: number
  w: number
  h: number
  anchorY: number
  problem: boolean
}

export type DebugDim = {
  kind: 'gap' | 'pad'
  text: string
  /** 括号两端，设备像素 */
  x1: number
  y1: number
  x2: number
  y2: number
  /** 文字底色块 */
  x: number
  y: number
  w: number
  h: number
}

export type DebugSheetLayout = {
  scale: number
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
  width: number
  height: number
  posterX: number
  posterY: number
  posterW: number
  posterH: number
  labels: DebugLabel[]
  dims: DebugDim[]
}

function fmtPx(n: number): string {
  const r = Math.round(n * 10) / 10
  return Math.abs(r - Math.round(r)) < 0.05 ? String(Math.round(r)) : r.toFixed(1)
}

function parentPath(path: string): string | null {
  const i = path.lastIndexOf('/')
  return i < 0 ? null : path.slice(0, i)
}

function assignLanes(spans: Array<{ a: number; b: number }>): number[] {
  const lanes: Array<Array<{ a: number; b: number }>> = []
  return spans.map((span) => {
    const a = Math.min(span.a, span.b)
    const b = Math.max(span.a, span.b)
    for (let i = 0; i < lanes.length; i++) {
      const hit = lanes[i]!.some((s) => a < s.b && b > s.a)
      if (!hit) {
        lanes[i]!.push({ a, b })
        return i
      }
    }
    lanes.push([{ a, b }])
    return lanes.length - 1
  })
}

type RawDim = {
  kind: 'gap' | 'pad'
  text: string
  axis: 'x' | 'y'
  side: 'left' | 'right' | 'top'
  a: number
  b: number
  /** 文字要占的源坐标范围，避免相邻标注叠在一起 */
  occA: number
  occB: number
}

function collectDims(report: FvgReport, scale: number): RawDim[] {
  const textHalf = 52 / Math.max(scale, 0.25)
  const dims: RawDim[] = []
  const byParent = new Map<string, ElementReport[]>()
  for (const el of report.elements) {
    const parent = parentPath(el.path)
    if (!parent) continue
    const list = byParent.get(parent) ?? []
    list.push(el)
    byParent.set(parent, list)
  }

  for (const el of report.elements) {
    if (!el.direction) continue
    const children = (byParent.get(el.path) ?? []).slice()
    if (children.length < 2) continue
    const vertical = el.direction === 'column'
    children.sort((a, b) => (vertical ? a.box.top - b.box.top : a.box.left - b.box.left))
    const cx = children.reduce((sum, c) => sum + c.box.centerX, 0) / children.length
    const side: RawDim['side'] = vertical ? (cx <= report.width / 2 ? 'left' : 'right') : 'top'
    for (let i = 0; i < children.length - 1; i++) {
      const prev = children[i]!
      const next = children[i + 1]!
      const gap = vertical ? next.box.top - prev.box.bottom : next.box.left - prev.box.right
      if (gap <= 0.5) continue
      const a = vertical ? prev.box.bottom : prev.box.right
      const b = vertical ? next.box.top : next.box.left
      const mid = (a + b) / 2
      dims.push({
        kind: 'gap',
        text: `gap ${fmtPx(gap)}`,
        axis: vertical ? 'y' : 'x',
        side,
        a,
        b,
        occA: Math.min(a, mid - textHalf),
        occB: Math.max(b, mid + textHalf),
      })
    }
  }

  for (const el of report.elements) {
    const pad = el.padding
    if (!pad) continue
    const border = el.border ?? 0
    const side: RawDim['side'] = el.box.centerX <= report.width / 2 ? 'left' : 'right'
    const pushY = (a: number, b: number, text: string) => {
      const mid = (a + b) / 2
      dims.push({
        kind: 'pad',
        text,
        axis: 'y',
        side,
        a,
        b,
        occA: Math.min(a, mid - textHalf),
        occB: Math.max(b, mid + textHalf),
      })
    }
    const pushX = (a: number, b: number, text: string) => {
      const mid = (a + b) / 2
      dims.push({
        kind: 'pad',
        text,
        axis: 'x',
        side: 'top',
        a,
        b,
        occA: Math.min(a, mid - textHalf),
        occB: Math.max(b, mid + textHalf),
      })
    }
    if (pad.top > 0.5) pushY(el.box.top + border, el.box.top + border + pad.top, `pad ${fmtPx(pad.top)}`)
    if (pad.bottom > 0.5) pushY(el.box.bottom - border - pad.bottom, el.box.bottom - border, `pad ${fmtPx(pad.bottom)}`)
    if (pad.left > 0.5) pushX(el.box.left + border, el.box.left + border + pad.left, `pad ${fmtPx(pad.left)}`)
    if (pad.right > 0.5) pushX(el.box.right - border - pad.right, el.box.right - border, `pad ${fmtPx(pad.right)}`)
  }

  const seen = new Set<string>()
  return dims.filter((d) => {
    const key = `${d.kind}|${d.axis}|${d.side}|${Math.round(d.a)}|${Math.round(d.b)}|${d.text}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function packLabels(desired: number[], minY: number, h: number, gap: number): number[] {
  const order = desired.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  const placed = new Array<number>(desired.length)
  let cursor = minY
  for (const item of order) {
    const y = Math.max(item.y - h / 2, cursor)
    placed[item.i] = y
    cursor = y + h + gap
  }
  return placed
}

/** 编号、gap、padding 都排在画面外侧。海报区域本身不画线。 */
export function layoutDebugSheet(report: FvgReport, scale: number): DebugSheetLayout {
  const problems = pathsWithProblems(report.issues)
  const raw = collectDims(report, scale)
  const groups = {
    left: raw.filter((d) => d.side === 'left'),
    right: raw.filter((d) => d.side === 'right'),
    top: raw.filter((d) => d.side === 'top'),
  }
  const leftLanes = assignLanes(groups.left.map((d) => ({ a: d.occA, b: d.occB })))
  const rightLanes = assignLanes(groups.right.map((d) => ({ a: d.occA, b: d.occB })))
  const topLanes = assignLanes(groups.top.map((d) => ({ a: d.occA, b: d.occB })))
  const lanesLeft = leftLanes.length ? Math.max(...leftLanes) + 1 : 0
  const lanesRight = rightLanes.length ? Math.max(...rightLanes) + 1 : 0
  const lanesTop = topLanes.length ? Math.max(...topLanes) + 1 : 0

  const marginLeft = SCALE_STRIP + lanesLeft * V_LANE + LABEL_COL + SHEET_PAD
  const marginRight = SCALE_STRIP + lanesRight * V_LANE + LABEL_COL + SHEET_PAD
  const marginTop = SCALE_STRIP + lanesTop * H_LANE + SHEET_PAD
  const marginBottom = SHEET_PAD + SCALE_STRIP
  const posterW = Math.round(report.width * scale)
  const posterH = Math.round(report.height * scale)
  const posterX = marginLeft
  const posterY = marginTop

  const leftIdx: number[] = []
  const rightIdx: number[] = []
  for (let n = 0; n < report.elements.length; n++) {
    const el = report.elements[n]!
    if (el.box.centerX <= report.width / 2) leftIdx.push(n)
    else rightIdx.push(n)
  }
  const yOf = (n: number) => posterY + report.elements[n]!.box.centerY * scale
  const leftY = packLabels(leftIdx.map(yOf), SHEET_PAD, LABEL_H, LABEL_GAP)
  const rightY = packLabels(rightIdx.map(yOf), SHEET_PAD, LABEL_H, LABEL_GAP)
  const labels: DebugLabel[] = []
  leftIdx.forEach((n, i) => {
    labels.push({
      n,
      side: 'left',
      x: SHEET_PAD,
      y: leftY[i]!,
      w: LABEL_COL - 6,
      h: LABEL_H,
      anchorY: yOf(n),
      problem: problems.has(report.elements[n]!.path),
    })
  })
  rightIdx.forEach((n, i) => {
    labels.push({
      n,
      side: 'right',
      x: posterX + posterW + SCALE_STRIP + lanesRight * V_LANE + 4,
      y: rightY[i]!,
      w: LABEL_COL - 6,
      h: LABEL_H,
      anchorY: yOf(n),
      problem: problems.has(report.elements[n]!.path),
    })
  })

  const labelBottom = labels.reduce((m, l) => Math.max(m, l.y + l.h), posterY + posterH)
  const extra = Math.max(0, labelBottom + SHEET_PAD - (posterY + posterH + marginBottom))

  const dims: DebugDim[] = []
  const place = (group: RawDim[], lanes: number[], side: 'left' | 'right' | 'top') => {
    group.forEach((d, i) => {
      const lane = lanes[i]!
      if (side === 'top') {
        const y = posterY - SCALE_STRIP - (lane + 1) * H_LANE + H_LANE / 2
        const x1 = posterX + d.a * scale
        const x2 = posterX + d.b * scale
        const textW = Math.max(36, d.text.length * 7)
        const mid = (x1 + x2) / 2
        dims.push({
          kind: d.kind,
          text: d.text,
          x1,
          y1: y,
          x2,
          y2: y,
          x: mid - textW / 2,
          y: y - 12,
          w: textW,
          h: 14,
        })
        return
      }
      const toward = side === 'left' ? -1 : 1
      const edge = side === 'left' ? posterX : posterX + posterW
      const laneX = edge + toward * (SCALE_STRIP + (lane + 0.5) * V_LANE)
      const y1 = posterY + Math.min(d.a, d.b) * scale
      const y2 = posterY + Math.max(d.a, d.b) * scale
      const textW = Math.min(V_LANE - 8, Math.max(36, d.text.length * 7))
      const mid = (y1 + y2) / 2
      const textX = laneX - textW / 2
      dims.push({
        kind: d.kind,
        text: d.text,
        x1: laneX,
        y1,
        x2: laneX,
        y2,
        x: textX,
        y: mid - 7,
        w: textW,
        h: 14,
      })
    })
  }
  place(groups.left, leftLanes, 'left')
  place(groups.right, rightLanes, 'right')
  place(groups.top, topLanes, 'top')

  return {
    scale,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom: marginBottom + extra,
    width: marginLeft + posterW + marginRight,
    height: marginTop + posterH + marginBottom + extra,
    posterX,
    posterY,
    posterW,
    posterH,
    labels,
    dims,
  }
}

function strokeBracket(ctx: CanvasRenderingContext2D, dim: DebugDim, posterX: number, posterR: number) {
  const vertical = Math.abs(dim.x1 - dim.x2) < 0.5
  ctx.save()
  ctx.strokeStyle = dim.kind === 'pad' ? '#1d4e89' : '#9a3412'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(dim.x1, dim.y1)
  ctx.lineTo(dim.x2, dim.y2)
  if (vertical) {
    ctx.moveTo(dim.x1 - 4, dim.y1)
    ctx.lineTo(dim.x1 + 4, dim.y1)
    ctx.moveTo(dim.x2 - 4, dim.y2)
    ctx.lineTo(dim.x2 + 4, dim.y2)
    const edge = dim.x1 < posterX ? posterX - 1 : posterR + 1
    ctx.moveTo(dim.x1, dim.y1)
    ctx.lineTo(edge, dim.y1)
    ctx.moveTo(dim.x2, dim.y2)
    ctx.lineTo(edge, dim.y2)
  } else {
    ctx.moveTo(dim.x1, dim.y1 - 4)
    ctx.lineTo(dim.x1, dim.y1 + 4)
    ctx.moveTo(dim.x2, dim.y2 - 4)
    ctx.lineTo(dim.x2, dim.y2 + 4)
  }
  ctx.stroke()
  ctx.restore()
}

export function renderDebugSheet(poster: Canvas, report: FvgReport, scale: number): { canvas: Canvas; layout: DebugSheetLayout } {
  const layout = layoutDebugSheet(report, scale)
  const canvas = createCanvas(layout.width, layout.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = SHEET_BG
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.drawImage(poster as unknown as Canvas, layout.posterX, layout.posterY)

  ctx.save()
  ctx.strokeStyle = '#1c1916'
  ctx.lineWidth = 1
  ctx.strokeRect(layout.posterX - 1.5, layout.posterY - 1.5, layout.posterW + 3, layout.posterH + 3)
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#8a8175'
  ctx.font = '10px sans-serif'
  ctx.textBaseline = 'top'
  for (let x = 0; x <= report.width; x += 100) {
    const dx = layout.posterX + x * scale
    ctx.fillText(String(x), dx + 2, layout.posterY - SCALE_STRIP + 2)
  }
  ctx.textBaseline = 'bottom'
  for (let y = 0; y <= report.height; y += 100) {
    const dy = layout.posterY + y * scale
    ctx.fillText(String(y), layout.posterX - SCALE_STRIP + 1, dy - 1)
  }
  ctx.restore()

  for (const dim of layout.dims) {
    strokeBracket(ctx, dim, layout.posterX, layout.posterX + layout.posterW)
    ctx.save()
    ctx.fillStyle = SHEET_BG
    ctx.fillRect(dim.x, dim.y, dim.w, dim.h)
    ctx.fillStyle = dim.kind === 'pad' ? '#1d4e89' : '#9a3412'
    ctx.font = '12px sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(dim.text, dim.x + 1, dim.y + 1)
    ctx.restore()
  }

  for (const label of layout.labels) {
    ctx.save()
    ctx.strokeStyle = label.problem ? '#b42318' : '#8d867c'
    ctx.lineWidth = 1
    const spine = label.side === 'left' ? layout.posterX - 5 : layout.posterX + layout.posterW + 5
    const edge = label.side === 'left' ? layout.posterX - 1 : layout.posterX + layout.posterW + 1
    const labelCy = label.y + label.h / 2
    const labelX = label.side === 'left' ? label.x + label.w : label.x
    ctx.beginPath()
    ctx.moveTo(labelX, labelCy)
    ctx.lineTo(spine, labelCy)
    ctx.lineTo(spine, label.anchorY)
    ctx.lineTo(edge, label.anchorY)
    ctx.stroke()
    ctx.fillStyle = label.problem ? '#b42318' : '#1c1916'
    ctx.fillRect(label.x, label.y, label.w, label.h)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 11px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(`#${label.n}`, label.x + label.w / 2, label.y + label.h / 2 + 0.5)
    ctx.restore()
  }

  return { canvas, layout }
}

export function focusDeviceRect(layout: DebugSheetLayout, el: ElementReport, n: number): { x: number; y: number; width: number; height: number } {
  const scale = layout.scale
  const pad = Math.max(40, Math.max(el.box.width, el.box.height) * 0.25) * scale
  let left = layout.posterX + el.box.left * scale - pad
  let top = layout.posterY + el.box.top * scale - pad
  let right = layout.posterX + el.box.right * scale + pad
  let bottom = layout.posterY + el.box.bottom * scale + pad
  const label = layout.labels.find((l) => l.n === n)
  if (label) {
    left = Math.min(left, label.x - 8)
    top = Math.min(top, label.y - 8)
    right = Math.max(right, label.x + label.w + 8)
    bottom = Math.max(bottom, label.y + label.h + 8)
  }
  for (const dim of layout.dims) {
    const nearY = Math.abs(dim.y1 - (layout.posterY + el.box.top * scale)) < 2
      || Math.abs(dim.y1 - (layout.posterY + el.box.bottom * scale)) < 2
      || Math.abs(dim.y2 - (layout.posterY + el.box.top * scale)) < 2
      || Math.abs(dim.y2 - (layout.posterY + el.box.bottom * scale)) < 2
    const nearX = Math.abs(dim.x1 - (layout.posterX + el.box.left * scale)) < 2
      || Math.abs(dim.x1 - (layout.posterX + el.box.right * scale)) < 2
      || Math.abs(dim.x2 - (layout.posterX + el.box.left * scale)) < 2
      || Math.abs(dim.x2 - (layout.posterX + el.box.right * scale)) < 2
    if (!nearY && !nearX) continue
    left = Math.min(left, dim.x - 4, dim.x1 - 6, dim.x2 - 6)
    top = Math.min(top, dim.y - 4, dim.y1 - 6, dim.y2 - 6)
    right = Math.max(right, dim.x + dim.w + 4, dim.x1 + 6, dim.x2 + 6)
    bottom = Math.max(bottom, dim.y + dim.h + 4, dim.y1 + 6, dim.y2 + 6)
  }
  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(layout.width, right)
  bottom = Math.min(layout.height, bottom)
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

export function resolveFocusIndex(report: FvgReport, token: string): number | undefined {
  if (/^\d+$/.test(token)) {
    const n = Number(token)
    if (n >= 0 && n < report.elements.length) return n
    return undefined
  }
  const idx = report.elements.findIndex((e) => e.id === token)
  return idx >= 0 ? idx : undefined
}

export function focusCropRect(el: ElementReport, doc: FvgDocument): Rect {
  const padX = Math.max(40, el.box.width * 0.25)
  const padY = Math.max(40, el.box.height * 0.25)
  const left = Math.max(0, el.box.left - padX)
  const top = Math.max(0, el.box.top - padY)
  const right = Math.min(doc.width, el.box.right + padX)
  const bottom = Math.min(doc.height, el.box.bottom + padY)
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  }
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** 从调试图上按设备像素裁出一块，长边不超过 1024 */
export function cropFocusFromCanvas(
  canvas: Canvas,
  crop: { x: number; y: number; width: number; height: number },
  maxLongEdge = 1024,
): Buffer {
  const sx = Math.max(0, Math.round(crop.x))
  const sy = Math.max(0, Math.round(crop.y))
  const sw = Math.max(1, Math.round(crop.width))
  const sh = Math.max(1, Math.round(crop.height))
  let outW = sw
  let outH = sh
  const long = Math.max(outW, outH)
  if (long > maxLongEdge) {
    const k = maxLongEdge / long
    outW = Math.max(1, Math.round(outW * k))
    outH = Math.max(1, Math.round(outH * k))
  }
  const out = createCanvas(outW, outH)
  const ctx = out.getContext('2d')
  ctx.drawImage(canvas as unknown as Canvas, sx, sy, sw, sh, 0, 0, outW, outH)
  return out.toBuffer('image/png')
}

export function elementIndexForPath(report: FvgReport, path: string): number {
  if (path === 'fvg') return 0
  const idx = report.elements.findIndex((e) => e.path === path)
  return idx >= 0 ? idx : 0
}

function pathDepth(path: string): number {
  if (path === 'fvg') return 0
  return path.split('/').length - 1
}

function fmtRect(r: Rect): string {
  return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`
}

function elementSummary(el: ElementReport): string {
  if (el.glow) {
    return `glow blur=${el.glow.blur} ${el.glow.color}`
  }
  if (el.shadow) {
    return `shadow ${el.shadow.x} ${el.shadow.y} blur=${el.shadow.blur}`
  }
  if (el.lines?.length) {
    const text = el.lines.map((l) => l.text).join('').replace(/\s+/g, ' ').trim()
    if (text) return text.length > 16 ? `${text.slice(0, 16)}…` : text
  }
  return '—'
}

function lineLabel(line: number | undefined): string {
  return line != null ? `L${line}` : 'L?'
}

export function formatDebugIndex(
  report: FvgReport,
  doc: FvgDocument,
  meta: DebugIndexMeta,
  focusIndices: number[] = [],
): string {
  const errors = report.issues.filter((i) => i.level === 'error').length
  const warns = report.issues.filter((i) => i.level === 'warn').length
  const infos = report.issues.filter((i) => i.level === 'info').length
  const lines: string[] = []

  lines.push('# FVG Debug')
  lines.push('')
  lines.push(`- 文件：\`${meta.sourceFile}\``)
  lines.push(`- 画布：${report.width}×${report.height} px`)
  lines.push(`- 导出倍率：${meta.scale}`)
  lines.push(`- 元素：${report.elements.length} 个`)
  lines.push(`- 问题：error ${errors} · warn ${warns} · info ${infos}`)
  lines.push('')
  lines.push('编号 `#n` 标在画面外侧，对应 `report.json` 的 `elements[n]`。`gap`、`padding` 也标在外侧。坐标均为源文件像素。画面本身与 render.png 相同。')
  lines.push('')

  lines.push('## 问题')
  lines.push('')
  if (report.issues.length === 0) {
    lines.push('（无）')
  } else {
    for (const issue of report.issues) {
      const n = elementIndexForPath(report, issue.path)
      const el = report.elements[n]
      lines.push(
        `#${n} ${issue.level} ${issue.code} ${issue.path} ${lineLabel(el?.line)} ${issue.message}`,
      )
    }
  }
  lines.push('')

  lines.push('## 元素')
  lines.push('')
  lines.push('| # | 标签 | id | 位置 | 盒子 | 着墨 | 效果 | 行 | 摘要 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (let n = 0; n < report.elements.length; n++) {
    const el = report.elements[n]!
    const indent = '  '.repeat(pathDepth(el.path))
    const id = el.id ?? '—'
    const pos = `${Math.round(el.box.x)},${Math.round(el.box.y)}`
    lines.push(
      `| ${n} | ${indent}${el.tag} | ${id} | ${pos} | ${fmtRect(el.box)} | ${fmtRect(el.ink)} | ${el.effect ? fmtRect(el.effect) : '—'} | ${lineLabel(el.line)} | ${elementSummary(el)} |`,
    )
  }
  lines.push('')

  for (const n of focusIndices) {
    const el = report.elements[n]
    if (!el) continue
    const crop = focusCropRect(el, doc)
    lines.push(`## Focus #${n}${el.id ? ` (${el.id})` : ''}`)
    lines.push('')
    lines.push(`- 标签：${el.tag}`)
    lines.push(`- 路径：${el.path}`)
    lines.push(`- 行：${lineLabel(el.line)}`)
    lines.push(`- 盒子：${fmtRect(el.box)}`)
    lines.push(`- 着墨：${fmtRect(el.ink)}`)
    if (el.effect) lines.push(`- 效果：${fmtRect(el.effect)}`)
    lines.push(`- 裁图：focus-${n}.png（${Math.round(crop.width)}×${Math.round(crop.height)} 源像素区域）`)
    lines.push('')
    lines.push('邻近元素（与裁图区域相交）：')
    const neighbors = report.elements
      .map((other, i) => ({ other, i }))
      .filter(({ other, i }) => i !== n && rectsIntersect(other.box, crop))
    if (neighbors.length === 0) {
      lines.push('- （无）')
    } else {
      for (const { other, i } of neighbors) {
        lines.push(`- #${i} ${other.tag}${other.id ? ` id=${other.id}` : ''} ${fmtRect(other.box)}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

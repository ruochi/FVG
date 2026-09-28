import { createCanvas, type Canvas } from '@napi-rs/canvas'
import type { ElementReport, FvgDocument, FvgReport, Rect } from './types.js'

export type DebugIndexMeta = {
  sourceFile: string
  scale: number
}

function pushUnique(list: number[], value: number) {
  if (list.some((n) => Math.abs(n - value) < 0.5)) return
  list.push(value)
}

/** 每个元素盒子的左右、上下。重合的边收成一条线，靠近的边各自保留。 */
export function guideAxes(report: FvgReport): { x: number[]; y: number[] } {
  const x: number[] = []
  const y: number[] = []
  for (const el of report.elements) {
    pushUnique(x, el.box.left)
    pushUnique(x, el.box.right)
    pushUnique(y, el.box.top)
    pushUnique(y, el.box.bottom)
  }
  x.sort((a, b) => a - b)
  y.sort((a, b) => a - b)
  return { x, y }
}

/** 横线画向更近的左或右，纵线画向更近的上或下，停在元素远端，不贯穿整张图。 */
export function guideSegments(report: FvgReport): Array<{ axis: 'h' | 'v'; pos: number; from: number; to: number }> {
  const segs: Array<{ axis: 'h' | 'v'; pos: number; from: number; to: number }> = []
  const seen = new Set<string>()
  const add = (axis: 'h' | 'v', pos: number, from: number, to: number) => {
    const a = Math.min(from, to)
    const b = Math.max(from, to)
    if (b - a < 0.5) return
    const key = `${axis}|${Math.round(pos * 2)}|${Math.round(a)}|${Math.round(b)}`
    if (seen.has(key)) return
    seen.add(key)
    segs.push({ axis, pos, from: a, to: b })
  }
  const width = report.width
  const height = report.height
  for (const el of report.elements) {
    const box = el.box
    const toLeft = box.centerX <= width / 2
    const toTop = box.centerY <= height / 2
    const x0 = toLeft ? 0 : box.left
    const x1 = toLeft ? box.right : width
    const y0 = toTop ? 0 : box.top
    const y1 = toTop ? box.bottom : height
    add('h', box.top, x0, x1)
    add('h', box.bottom, x0, x1)
    add('v', box.left, y0, y1)
    add('v', box.right, y0, y1)
  }
  return segs
}

/** 在原图上画横线和纵线，不写数字。每条线只画向离元素更近的那一侧。 */
export function renderDebugSheet(poster: Canvas, report: FvgReport, scale: number): Canvas {
  const canvas = createCanvas(poster.width, poster.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(poster as unknown as Canvas, 0, 0)
  const marks = new Set<string>()
  const mark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
    marks.add(`${x},${y}`)
  }
  for (const seg of guideSegments(report)) {
    if (seg.axis === 'h') {
      const py = Math.round(seg.pos * scale)
      const x0 = Math.round(seg.from * scale)
      const x1 = Math.round(seg.to * scale)
      for (let x = x0; x <= x1; x++) mark(x, py)
    } else {
      const px = Math.round(seg.pos * scale)
      const y0 = Math.round(seg.from * scale)
      const y1 = Math.round(seg.to * scale)
      for (let y = y0; y <= y1; y++) mark(px, y)
    }
  }
  ctx.save()
  ctx.globalCompositeOperation = 'difference'
  ctx.fillStyle = '#ffffff'
  for (const key of marks) {
    const [x, y] = key.split(',')
    ctx.fillRect(Number(x), Number(y), 1, 1)
  }
  ctx.restore()
  return canvas
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
  lines.push('调试图画出元素盒子的横线和纵线，不标数字。横线只画向更近的左边或右边，纵线只画向更近的上边或下边，不贯穿整张图。精确坐标看下面的元素表。')
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

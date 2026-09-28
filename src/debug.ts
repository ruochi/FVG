import { createCanvas, type Canvas, type SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas'
import type { ElementReport, FvgDocument, FvgReport, Issue, Rect } from './types.js'

export type DebugOverlayOptions = {
  scale: number
}

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

function strokeDashedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dash: number[],
) {
  ctx.beginPath()
  ctx.setLineDash(dash)
  ctx.strokeRect(x + 0.5, y + 0.5, w, h)
  ctx.setLineDash([])
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) {
  ctx.strokeStyle = 'rgba(180, 180, 200, 0.45)'
  ctx.lineWidth = 1 / scale
  ctx.fillStyle = 'rgba(80, 80, 100, 0.85)'
  ctx.font = `${11}px sans-serif`
  ctx.textBaseline = 'top'

  for (let x = 0; x <= width; x += 100) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y += 100) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (let x = 0; x <= width; x += 100) {
    ctx.fillText(String(x), x * scale + 2, 2)
  }
  ctx.textBaseline = 'bottom'
  for (let y = 0; y <= height; y += 100) {
    if (y === 0) continue
    ctx.fillText(String(y), 2, y * scale - 2)
  }
  ctx.restore()
}

function drawSafeArea(
  ctx: CanvasRenderingContext2D,
  doc: FvgDocument,
) {
  const { width, height, safe } = doc
  const x = safe.left
  const y = safe.top
  const w = width - safe.left - safe.right
  const h = height - safe.top - safe.bottom
  ctx.strokeStyle = 'rgba(120, 120, 140, 0.75)'
  ctx.lineWidth = 1
  strokeDashedRect(ctx, x, y, w, h, [6, 4])
}

function drawElementBadge(ctx: CanvasRenderingContext2D, n: number, srcX: number, srcY: number, scale: number) {
  const label = `#${n}`
  const padX = 4
  const padY = 2
  const fontSize = 11
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `600 ${fontSize}px sans-serif`
  const tw = ctx.measureText(label).width
  const bx = srcX * scale
  const by = srcY * scale
  const bw = tw + padX * 2
  const bh = fontSize + padY * 2
  ctx.fillStyle = 'rgba(20, 24, 40, 0.88)'
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.fillText(label, bx + padX, by + padY)
  ctx.restore()
}

/** 在已渲染的画布上叠加调试信息（坐标为源文件像素） */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  report: FvgReport,
  doc: FvgDocument,
  opts: DebugOverlayOptions,
) {
  const { scale } = opts
  const problems = pathsWithProblems(report.issues)

  ctx.save()
  ctx.scale(scale, scale)
  drawGrid(ctx, doc.width, doc.height, scale)
  drawSafeArea(ctx, doc)

  for (let n = 0; n < report.elements.length; n++) {
    const el = report.elements[n]!
    const problem = problems.has(el.path)
    const box = el.box
    const ink = el.ink

    ctx.lineWidth = problem ? 2.5 : 1
    ctx.strokeStyle = problem ? 'rgba(220, 40, 40, 0.95)' : 'rgba(0, 120, 255, 0.85)'
    ctx.strokeRect(box.left + 0.5, box.top + 0.5, box.width, box.height)

    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.85)'
    ctx.strokeRect(ink.left + 0.5, ink.top + 0.5, ink.width, ink.height)

    if (el.effect) {
      ctx.strokeStyle = 'rgba(230, 180, 0, 0.9)'
      strokeDashedRect(ctx, el.effect.left, el.effect.top, el.effect.width, el.effect.height, [5, 3])
    }
  }
  ctx.restore()

  for (let n = 0; n < report.elements.length; n++) {
    const el = report.elements[n]!
    drawElementBadge(ctx, n, el.box.left, el.box.top, scale)
  }
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

/** 从 1 倍已绘制的调试图裁出 focus 区域，长边不超过 1024 */
export function cropFocusFromCanvas(canvas: Canvas, crop: Rect, maxLongEdge = 1024): Buffer {
  const scale = 1
  const sx = Math.round(crop.left * scale)
  const sy = Math.round(crop.top * scale)
  const sw = Math.max(1, Math.round(crop.width * scale))
  const sh = Math.max(1, Math.round(crop.height * scale))
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
  lines.push('编号 `#n` = `report.json` 的 `elements[n]`；坐标均为源文件像素。')
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

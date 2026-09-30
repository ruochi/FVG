import { applyToBox, aroundPivot, IDENTITY, intersectBox, multiply, originOffset, translated, type Matrix } from './matrix.js'
import type { Box, ElementReport, FvgDocument, FvgReport, Issue, LayoutNode } from './types.js'
import { boxToRect, translateBox, unionBoxes } from './types.js'

const VISIBLE_OPACITY = 0.01

function inkOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function hasArea(b: Box): boolean {
  return b.width > 1e-3 && b.height > 1e-3
}

function clipInk(ink: Box, clip: Box | undefined): Box {
  return clip ? intersectBox(ink, clip) : ink
}

function nodeMatrix(parent: Matrix, node: LayoutNode): Matrix {
  if (node.rotate === 0 && node.scale === 1) return parent
  const o = originOffset(node.origin, node.width, node.height)
  return multiply(parent, aroundPivot(node.x + o.x, node.y + o.y, node.rotate, node.scale))
}

function walk(
  node: LayoutNode,
  parentMatrix: Matrix,
  parentOpacity: number,
  ox: number,
  oy: number,
  clip: Box | undefined,
  elements: ElementReport[],
) {
  const absX = ox + node.x
  const absY = oy + node.y
  const matrix = nodeMatrix(parentMatrix, node)
  const opacity = parentOpacity * node.opacity
  let ink = clipInk(applyToBox(matrix, translateBox(node.ink, node.x, node.y)), clip)
  if (node.kind === 'layer' && node.overflow === 'hidden') {
    const selfClip = applyToBox(matrix, { x: node.x, y: node.y, width: node.width, height: node.height })
    ink = intersectBox(ink, clip ? intersectBox(selfClip, clip) : selfClip)
  }

  const entry: ElementReport = {
    path: node.path,
    id: node.id,
    tag: node.tag,
    box: boxToRect({ x: absX, y: absY, width: node.width, height: node.height }),
    ink: boxToRect(ink),
    opacity,
  }
  if (node.shadow) entry.shadow = node.shadow
  if (node.glow) entry.glow = node.glow
  if (node.kind === 'text') {
    const contentX = node.x + node.padding.left + (node.border?.width ?? 0)
    const contentY = node.y + node.padding.top + (node.border?.width ?? 0)
    entry.fontSize = node.textLayout.fontSize
    entry.lines = node.textLayout.lines.map((line) => ({
      text: line.segments.map((s) => s.text).join(''),
      box: boxToRect(clipInk(applyToBox(matrix, translateBox(line.ink, contentX, contentY)), clip)),
    }))
  }
  elements.push(entry)

  if (node.kind === 'layer' || node.kind === 'flex') {
    const inset = node.kind === 'flex' ? node.padding.left + (node.border?.width ?? 0) : 0
    const insetY = node.kind === 'flex' ? node.padding.top + (node.border?.width ?? 0) : 0
    const childMatrix = multiply(matrix, translated(node.x + inset, node.y + insetY))
    let childClip = clip
    if (node.kind === 'layer' && node.overflow === 'hidden') {
      const layerClip = applyToBox(matrix, { x: node.x, y: node.y, width: node.width, height: node.height })
      childClip = clip ? intersectBox(layerClip, clip) : layerClip
    }
    const start = elements.length
    for (const ch of node.children) walk(ch, childMatrix, opacity, absX + inset, absY + insetY, childClip, elements)
    // 容器的着墨改用子元素报告（已经带上变换和裁剪），避免把被裁掉的部分算进父级。
    let union: Box | null = null
    const add = (b: Box) => {
      if (b.width <= 1e-3 || b.height <= 1e-3) return
      union = union ? unionBoxes(union, b) : b
    }
    if ((node.background && node.background !== 'transparent') || (node.border && node.border.width > 0)) {
      add(clipInk(applyToBox(matrix, { x: node.x, y: node.y, width: node.width, height: node.height }), clip))
    }
    for (let i = start; i < elements.length; i++) add(elements[i]!.ink)
    if (union && node.kind === 'layer' && node.overflow === 'hidden') {
      const selfClip = applyToBox(matrix, { x: node.x, y: node.y, width: node.width, height: node.height })
      union = intersectBox(union, clip ? intersectBox(selfClip, clip) : selfClip)
    }
    if (union) entry.ink = boxToRect(union)
  }
}

export function buildReport(doc: FvgDocument): FvgReport {
  const elements: ElementReport[] = []
  walk(doc.root, IDENTITY, 1, 0, 0, undefined, elements)

  const issues: Issue[] = [...doc.issues]
  const visible = elements.filter((el) => el.opacity >= VISIBLE_OPACITY && hasArea(el.ink))

  for (const el of visible) {
    const inkOutside = el.ink.right > doc.width + 1e-3 || el.ink.bottom > doc.height + 1e-3 || el.ink.left < -1e-3 || el.ink.top < -1e-3
    if (inkOutside) {
      issues.push({
        level: 'error',
        code: 'overflow-canvas',
        path: el.path,
        message: '着墨超出画布',
      })
    }
    const effectPad = Math.max(
      el.shadow ? el.shadow.blur * 2 + el.shadow.spread + Math.max(Math.abs(el.shadow.x), Math.abs(el.shadow.y)) : 0,
      el.glow ? el.glow.blur * 2 + el.glow.spread : 0,
    )
    if (!inkOutside && effectPad > 0) {
      const outside =
        el.ink.left - effectPad < -1e-3 ||
        el.ink.top - effectPad < -1e-3 ||
        el.ink.right + effectPad > doc.width + 1e-3 ||
        el.ink.bottom + effectPad > doc.height + 1e-3
      if (outside) {
        issues.push({
          level: 'warn',
          code: 'effect-clipped',
          path: el.path,
          message: '本体在画布内，但阴影或光晕超出画布',
          hint: '把元素往里移，或减小 blur',
        })
      }
    }
    if (el.lines != null && (el.tag === 'h1' || el.tag === 'h2' || el.tag === 'h3' || el.tag === 'p' || el.tag === 'div' || el.tag === 'span')) {
      if (el.ink.left < doc.safe.left - 1e-3 || el.ink.right > doc.width - doc.safe.right + 1e-3) {
        issues.push({
          level: 'warn',
          code: 'outside-safe',
          path: el.path,
          message: '文字超出安全区',
        })
      }
      const minFs = (doc.width / 1080) * 24
      if ((el.fontSize ?? 0) < minFs - 1e-3) {
        issues.push({
          level: 'warn',
          code: 'min-font-size',
          path: el.path,
          message: `字号 ${el.fontSize}px 小于建议最小 ${minFs.toFixed(1)}px`,
        })
      }
    }
  }

  const textInks = visible.filter((e) => e.lines != null)
  for (let i = 0; i < textInks.length; i++) {
    for (let j = i + 1; j < textInks.length; j++) {
      const a = textInks[i]!
      const b = textInks[j]!
      if (inkOverlap(a.ink, b.ink)) {
        issues.push({
          level: 'warn',
          code: 'text-overlap',
          path: a.path,
          message: `文字与 ${b.path} 着墨重叠`,
        })
      }
    }
  }

  return {
    fvg: '0.1',
    width: doc.width,
    height: doc.height,
    elements,
    issues,
  }
}

export function formatIssueLine(issue: Issue): string {
  const sym = issue.level === 'error' ? '✗ error' : issue.level === 'warn' ? '! warn' : '· info'
  const line = `${sym}  ${issue.code.padEnd(16)} ${issue.path.padEnd(24)} ${issue.message}`
  return issue.hint ? `${line}\n         ${issue.hint}` : line
}

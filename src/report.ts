import type { Box, ElementReport, FvgDocument, FvgReport, Issue, LayoutNode, TextLayoutNode } from './types.js'
import { boxToRect, translateBox } from './types.js'

function inkOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function walk(node: LayoutNode, ox: number, oy: number, elements: ElementReport[]) {
  const absX = ox + node.x
  const absY = oy + node.y
  const box = boxToRect({ x: absX, y: absY, width: node.width, height: node.height })
  const ink = boxToRect(translateBox(node.ink, absX, absY))
  const entry: ElementReport = {
    path: node.path,
    id: node.id,
    tag: node.tag,
    box,
    ink,
  }
  if (node.kind === 'text') {
    entry.fontSize = node.textLayout.fontSize
    entry.lines = node.textLayout.lines.map((line) => ({
      text: line.segments.map((s) => s.text).join(''),
      box: boxToRect(
        translateBox(line.ink, absX + node.padding.left + (node.border?.width ?? 0), absY + node.padding.top + (node.border?.width ?? 0)),
      ),
    }))
  }
  elements.push(entry)

  if (node.kind === 'layer' || node.kind === 'flex') {
    for (const ch of node.children) walk(ch, absX, absY, elements)
  } else if (node.kind === 'sqrt') {
    walk(node.child, absX, absY, elements)
  }
}

export function buildReport(doc: FvgDocument): FvgReport {
  const elements: ElementReport[] = []
  walk(doc.root, 0, 0, elements)

  const issues: Issue[] = [...doc.issues]

  for (const el of elements) {
    if (el.ink.right > doc.width + 1e-3 || el.ink.bottom > doc.height + 1e-3 || el.ink.left < -1e-3 || el.ink.top < -1e-3) {
      issues.push({
        level: 'error',
        code: 'overflow-canvas',
        path: el.path,
        message: '着墨超出画布',
      })
    }
    if (el.tag === 'h1' || el.tag === 'h2' || el.tag === 'h3' || el.tag === 'p' || el.tag === 'div' || el.tag === 'span') {
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

  const textInks = elements.filter((e) => e.lines != null)
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
  return `${sym}  ${issue.code.padEnd(16)} ${issue.path.padEnd(24)} ${issue.message}`
}

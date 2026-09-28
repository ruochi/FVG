import {
  cropFocusFromCanvas,
  focusCropRect,
  formatDebugIndex,
  renderDebugSheet,
  resolveFocusIndex,
} from './debug.js'
import { layoutSource } from './layout.js'
import { paintDocumentCanvas } from './paint.js'
import { buildReport } from './report.js'
import type { FvgReport, RenderOptions } from './types.js'
import { initFontsForMeasure, setFontsCacheDir } from './fonts.js'

export type RenderResult = {
  png: Buffer
  report: FvgReport
}

export type DebugOptions = RenderOptions & {
  /** 元素编号或 id，可重复 */
  focus?: string[]
  /** 用于 index.md 展示的文件名 */
  sourceName?: string
}

export type DebugFocusImage = {
  n: number
  png: Buffer
}

export type DebugResult = {
  renderPng: Buffer
  debugPng: Buffer
  report: FvgReport
  index: string
  focus: DebugFocusImage[]
}

export async function renderFvg(source: string, options: RenderOptions = {}): Promise<RenderResult> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const baseDir = options.baseDir ?? process.cwd()
  const doc = await layoutSource(source, baseDir)
  const png = paintDocumentCanvas(doc.root, {
    width: doc.width,
    height: doc.height,
    background: doc.background,
    scale: options.scale ?? 1,
    debug: options.debug ?? false,
  }).toBuffer('image/png')
  const report = buildReport(doc)
  return { png, report }
}

export async function debugFvg(source: string, options: DebugOptions = {}): Promise<DebugResult> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const baseDir = options.baseDir ?? process.cwd()
  const scale = options.scale ?? 1
  const doc = await layoutSource(source, baseDir)
  const report = buildReport(doc)

  const paintOpts = {
    width: doc.width,
    height: doc.height,
    background: doc.background,
    scale,
    debug: false,
  }

  const canvas = paintDocumentCanvas(doc.root, paintOpts)
  const renderPng = canvas.toBuffer('image/png')

  const debugPng = renderDebugSheet(canvas, report, scale).toBuffer('image/png')

  const focusTokens = options.focus ?? []
  const focusIndices: number[] = []
  for (const token of focusTokens) {
    const n = resolveFocusIndex(report, token)
    if (n != null && !focusIndices.includes(n)) focusIndices.push(n)
  }

  const focus: DebugFocusImage[] = []
  if (focusIndices.length > 0) {
    const poster1 = paintDocumentCanvas(doc.root, { ...paintOpts, scale: 1 })
    const sheet1 = renderDebugSheet(poster1, report, 1)
    for (const n of focusIndices) {
      const el = report.elements[n]
      if (!el) continue
      const crop = focusCropRect(el, doc)
      focus.push({ n, png: cropFocusFromCanvas(sheet1, crop) })
    }
  }

  const index = formatDebugIndex(report, doc, {
    sourceFile: options.sourceName ?? 'input.fvg',
    scale,
  }, focusIndices)

  return { renderPng, debugPng, report, index, focus }
}

export async function checkFvg(source: string, options: RenderOptions = {}): Promise<FvgReport> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const doc = await layoutSource(source, options.baseDir ?? process.cwd())
  return buildReport(doc)
}

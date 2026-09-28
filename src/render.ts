import { layoutSource } from './layout.js'
import { paintDocument } from './paint.js'
import { buildReport } from './report.js'
import type { FvgReport, RenderOptions } from './types.js'
import { initFontsForMeasure, setFontsCacheDir } from './fonts.js'

export type RenderResult = {
  png: Buffer
  report: FvgReport
}

export async function renderFvg(source: string, options: RenderOptions = {}): Promise<RenderResult> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const baseDir = options.baseDir ?? process.cwd()
  const doc = await layoutSource(source, baseDir)
  const png = paintDocument(doc.root, {
    width: doc.width,
    height: doc.height,
    background: doc.background,
    scale: options.scale ?? 1,
    debug: options.debug ?? false,
  })
  const report = buildReport(doc)
  return { png, report }
}

export async function checkFvg(source: string, options: RenderOptions = {}): Promise<FvgReport> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const doc = await layoutSource(source, options.baseDir ?? process.cwd())
  return buildReport(doc)
}

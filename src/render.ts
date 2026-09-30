import { layoutSource } from './layout.js'
import { paintDocument } from './paint.js'
import { buildReport } from './report.js'
import type { FlexLayerReport, RenderOptions } from './types.js'
import { initFontsForMeasure, setFontsCacheDir } from './fonts.js'
import type { FlexLayerNode } from './parse.js'

export type RenderResult = {
  png: Buffer
  report: FlexLayerReport
}

export async function renderFlexLayer(source: string | FlexLayerNode, options: RenderOptions = {}): Promise<RenderResult> {
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
    t: options.t ?? 0,
  })
  const report = buildReport(doc)
  return { png, report }
}

export async function checkFlexLayer(source: string | FlexLayerNode, options: RenderOptions = {}): Promise<FlexLayerReport> {
  if (options.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  await initFontsForMeasure({ fontsCacheDir: options.fontsCacheDir })
  const doc = await layoutSource(source, options.baseDir ?? process.cwd())
  return buildReport(doc)
}

/** 短名，与 renderFlexLayer / checkFlexLayer 相同。 */
export const renderLayer = renderFlexLayer
export const checkLayer = checkFlexLayer

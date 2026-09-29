export { renderFvg, checkFvg, type RenderResult } from './render.js'
export { parseFvg } from './parse.js'
export { h } from './h.js'
export { buildReport, formatIssueLine } from './report.js'
export type {
  FvgReport,
  RenderOptions,
  Issue,
  ElementReport,
  DrawFn,
  DrawElSnapshot,
  DrawComputedStyle,
} from './types.js'
export type { FvgNode, FvgChild } from './parse.js'

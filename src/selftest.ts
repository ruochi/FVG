import { createCanvas, loadImage } from '@napi-rs/canvas'
import { featureCases, type FeatureCase, type ProbeCtx } from './featureCases.js'
import { renderFvg } from './render.js'
import type { ElementReport, FvgReport } from './types.js'

export type { FeatureCase, ProbeCtx }

export type SelfTestResult = {
  id: string
  feature: string
  ok: boolean
  detail?: string
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = Number.parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function isWhite(p: { r: number; g: number; b: number }): boolean {
  return p.r > 230 && p.g > 230 && p.b > 230
}

class Ctx implements ProbeCtx {
  failures: string[] = []

  constructor(
    readonly report: FvgReport,
    private readonly at: (x: number, y: number) => { r: number; g: number; b: number; a: number },
  ) {}

  fail(message: string): void {
    this.failures.push(message)
  }

  byId(id: string): ElementReport {
    const el = this.report.elements.find((e) => e.id === id)
    if (!el) this.fail(`找不到 id=${id}`)
    return el ?? this.report.elements[0]!
  }

  issue(code: string, present = true): void {
    const hit = this.report.issues.some((i) => i.code === code)
    if (hit !== present) this.fail(present ? `缺少检查项 ${code}` : `不该出现 ${code}`)
  }

  eq(actual: number, expected: number, label: string): void {
    if (Math.abs(actual - expected) > 0.6) this.fail(`${label} 期望 ${expected} 实际 ${actual}`)
  }

  close(actual: number, expected: number, label: string, tol = 2): void {
    if (Math.abs(actual - expected) > tol) this.fail(`${label} 期望 ${expected}±${tol} 实际 ${actual}`)
  }

  lines(id: string): string[] {
    const el = this.byId(id)
    return (el.lines ?? []).map((l) => l.text)
  }

  fontSize(id: string, size: number): void {
    this.eq(this.byId(id).fontSize ?? -1, size, `${id} 字号`)
  }

  words(id: string, words: string[]): void {
    const lines = this.lines(id)
    for (const w of words) {
      if (!lines.some((l) => l.includes(w))) this.fail(`「${w}」没有整词落在一行：${JSON.stringify(lines)}`)
    }
  }

  noLineStart(id: string, chars: string): void {
    for (const line of this.lines(id)) {
      if (line[0] && chars.includes(line[0])) this.fail(`行首出现「${line[0]}」：${line}`)
    }
  }

  color(x: number, y: number, hex: string, tol = 28): void {
    const p = this.at(Math.round(x), Math.round(y))
    const e = parseHex(hex)
    if (Math.abs(p.r - e.r) > tol || Math.abs(p.g - e.g) > tol || Math.abs(p.b - e.b) > tol) {
      const got = `#${[p.r, p.g, p.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
      this.fail(`像素 (${x},${y}) 期望 ${hex} 实际 ${got}`)
    }
  }

  alpha(x: number, y: number, expected: number, tol = 8): void {
    const p = this.at(Math.round(x), Math.round(y))
    if (Math.abs(p.a - expected) > tol) this.fail(`像素 (${x},${y}) 透明度期望 ${expected} 实际 ${p.a}`)
  }

  region(x: number, y: number, w: number, h: number, mode: 'ink' | 'clear'): void {
    let ink = false
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const x1 = Math.round(x + w)
    const y1 = Math.round(y + h)
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        if (!isWhite(this.at(px, py))) ink = true
      }
    }
    if (mode === 'ink' && !ink) this.fail(`区域 (${x0},${y0})- (${x1},${y1}) 没有着墨`)
    if (mode === 'clear' && ink) this.fail(`区域 (${x0},${y0})- (${x1},${y1}) 不该有着墨`)
  }

  noId(id: string): void {
    if (this.report.elements.some((e) => e.id === id)) this.fail(`不该存在 id=${id}`)
  }

  inkBand(id: string, from: number, to: number, hex: string, tol = 80): void {
    const ink = this.byId(id).ink
    const x0 = Math.round(ink.x + ink.width * from)
    const x1 = Math.max(x0 + 1, Math.round(ink.x + ink.width * to))
    const y0 = Math.round(ink.y)
    const y1 = Math.max(y0 + 1, Math.round(ink.y + ink.height))
    const e = parseHex(hex)
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const p = this.at(px, py)
        if (Math.abs(p.r - e.r) <= tol && Math.abs(p.g - e.g) <= tol && Math.abs(p.b - e.b) <= tol && !isWhite(p)) return
      }
    }
    this.fail(`${id} 着墨横向 ${from}–${to} 没有接近 ${hex} 的像素`)
  }
}

async function pixelsOf(png: Buffer): Promise<(x: number, y: number) => { r: number; g: number; b: number; a: number }> {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return (x, y) => {
    const d = ctx.getImageData(x, y, 1, 1).data
    return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0, a: d[3] ?? 0 }
  }
}

export async function runSelfTest(): Promise<SelfTestResult[]> {
  const results: SelfTestResult[] = []
  for (const item of featureCases) {
    try {
      const { png, report } = await renderFvg(item.source, { baseDir: process.cwd() })
      const ctx = new Ctx(report, await pixelsOf(png))
      item.assert(ctx)
      results.push({
        id: item.id,
        feature: item.feature,
        ok: ctx.failures.length === 0,
        detail: ctx.failures.join('；'),
      })
    } catch (err) {
      results.push({
        id: item.id,
        feature: item.feature,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

export function formatSelfTest(results: SelfTestResult[]): string {
  const lines: string[] = []
  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    lines.push(r.ok ? `✓ ${r.id}  ${r.feature}` : `✗ ${r.id}  ${r.feature}`)
    if (!r.ok && r.detail) lines.push(`    ${r.detail}`)
  }
  lines.push(`${results.length - failed.length} 通过，${failed.length} 失败，共 ${results.length} 项`)
  return lines.join('\n')
}

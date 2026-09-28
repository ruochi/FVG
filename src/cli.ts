#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { checkFvg, debugFvg, renderFvg } from './render.js'
import { formatIssueLine } from './report.js'

function usage(): never {
  console.error(`用法:
  fvg render <file.fvg> [-o out.png] [--report out.json] [--scale 0.5] [--debug]
  fvg debug <file.fvg> [-o 目录] [--scale 0.5] [--focus 编号或id]...
  fvg check <file.fvg> [--report out.json]`)
  process.exit(2)
}

type ParsedArgs = {
  cmd: string
  file: string
  out: string | undefined
  report: string | undefined
  scale: number
  debug: boolean
  focus: string[]
}

function parseArgs(argv: string[]): ParsedArgs {
  const cmd = argv[0]
  const file = argv[1]
  if (!cmd || !file) usage()
  let out: string | undefined
  let report: string | undefined
  let scale = 1
  let debug = false
  const focus: string[] = []
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '-o') out = argv[++i]
    else if (a === '--report') report = argv[++i]
    else if (a === '--scale') scale = Number(argv[++i])
    else if (a === '--debug') debug = true
    else if (a === '--focus') focus.push(argv[++i] ?? '')
    else usage()
  }
  return { cmd, file, out, report, scale, debug, focus }
}

function defaultDebugDir(fvgPath: string): string {
  return fvgPath.replace(/\.fvg$/i, '') + '.debug'
}

async function runDebug(abs: string, source: string, baseDir: string, scale: number, outDir: string, focus: string[]) {
  const { renderPng, debugPng, report, index, focus: focusImages } = await debugFvg(source, {
    baseDir,
    scale,
    focus,
    sourceName: basename(abs),
  })
  await mkdir(outDir, { recursive: true })
  await writeFile(resolve(outDir, 'render.png'), renderPng)
  await writeFile(resolve(outDir, 'debug.png'), debugPng)
  await writeFile(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2))
  await writeFile(resolve(outDir, 'index.md'), index)
  for (const f of focusImages) {
    await writeFile(resolve(outDir, `focus-${f.n}.png`), f.png)
  }
  console.log(index)
  const errors = report.issues.filter((i) => i.level === 'error').length
  if (errors > 0) process.exit(1)
}

async function main() {
  const { cmd, file, out, report, scale, debug, focus } = parseArgs(process.argv.slice(2))
  const abs = resolve(file)
  const source = await readFile(abs, 'utf8')
  const baseDir = dirname(abs)

  if (cmd === 'check') {
    const rep = await checkFvg(source, { baseDir })
    for (const issue of rep.issues) console.log(formatIssueLine(issue))
    if (report) await writeFile(report, JSON.stringify(rep, null, 2))
    const errors = rep.issues.filter((i) => i.level === 'error').length
    if (errors > 0) process.exit(1)
    return
  }

  if (cmd === 'debug') {
    const outDir = out ? resolve(out) : defaultDebugDir(abs)
    await runDebug(abs, source, baseDir, scale, outDir, focus.filter(Boolean))
    return
  }

  if (cmd !== 'render') usage()

  const { png, report: rep } = await renderFvg(source, { baseDir, scale, debug })
  const outPath = out ?? abs.replace(/\.fvg$/i, '.png')
  await writeFile(outPath, png)
  for (const issue of rep.issues) console.log(formatIssueLine(issue))
  console.log(`✓ ${outPath}  ${rep.width}×${rep.height}  ${rep.elements.length} 个元素`)
  if (report) await writeFile(report, JSON.stringify(rep, null, 2))
  const errors = rep.issues.filter((i) => i.level === 'error').length
  if (errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

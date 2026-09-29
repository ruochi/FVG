import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderComposition } from '../src/index.js'
import { contactSheetFromPngs } from '../src/frame.js'
import { KEYFRAMES, pythagoras } from './pythagoras.js'

const dir = dirname(fileURLToPath(import.meta.url))
const mp4Path = join(dir, 'pythagoras.mp4')
const sheetPath = join(dir, 'pythagoras-sheet.png')
const keyframesPath = join(dir, 'pythagoras-keyframes.png')

async function encode(frames: Buffer[], fps: number, out: string) {
  await new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 退出码 ${code}`))))
    for (const frame of frames) ff.stdin.write(frame)
    ff.stdin.end()
  })
}

async function main() {
  const { frames, reports, contactSheet } = await renderComposition(pythagoras)

  const issues = new Map<string, { count: number; firstFrame: number; path: string; message: string }>()
  reports.forEach((report, frame) => {
    for (const issue of report.issues) {
      const key = `${issue.level} ${issue.code}`
      const seen = issues.get(key)
      if (seen) seen.count++
      else issues.set(key, { count: 1, firstFrame: frame, path: issue.path, message: issue.message })
    }
  })
  console.log(`frames ${frames.length}`)
  if (issues.size === 0) console.log('report: no issues in any frame')
  for (const [key, info] of issues) {
    console.log(`report: ${key} x${info.count}, first at frame ${info.firstFrame} ${info.path} ${info.message}`)
  }

  await writeFile(sheetPath, contactSheet)
  await writeFile(keyframesPath, await contactSheetFromPngs(KEYFRAMES.map((f) => frames[f]!)))
  await encode(frames, pythagoras.fps, mp4Path)
  console.log(mp4Path)
  console.log(keyframesPath)

  if ([...issues.keys()].some((key) => key.startsWith('error'))) process.exitCode = 1
}

main()

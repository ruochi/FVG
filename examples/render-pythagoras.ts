import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderComposition } from '../src/index.js'
import { pythagoras } from './pythagoras.js'

const dir = dirname(fileURLToPath(import.meta.url))
const mp4Path = join(dir, 'pythagoras.mp4')
const sheetPath = join(dir, 'pythagoras-sheet.png')

const { frames, contactSheet } = await renderComposition(pythagoras)
await writeFile(sheetPath, contactSheet)

await new Promise<void>((resolve, reject) => {
  const ff = spawn(
    'ffmpeg',
    [
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      String(pythagoras.fps),
      '-i',
      'pipe:0',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4Path,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  ff.on('error', reject)
  ff.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`ffmpeg 退出码 ${code}`))
  })
  for (const frame of frames) ff.stdin.write(frame)
  ff.stdin.end()
})

console.log(`frames ${frames.length}`)
console.log(mp4Path)
console.log(sheetPath)

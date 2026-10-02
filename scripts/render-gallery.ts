import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { renderLayer } from '../src/render.js'

function layerFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.layer'))
    .map((name) => `${dir}/${name}`)
}

/** 给 object-fit 示例用的色块图，宽高不成比例。 */
function writeSwatch() {
  const canvas = createCanvas(240, 120)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1a2430'
  ctx.fillRect(0, 0, 240, 120)
  ctx.fillStyle = '#f7931a'
  ctx.fillRect(0, 0, 80, 120)
  ctx.fillStyle = '#3ecfc4'
  ctx.beginPath()
  ctx.arc(160, 60, 36, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f4efe4'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('FL', 96, 70)
  writeFileSync('docs/gallery/swatch.png', canvas.toBuffer('image/png'))
}

writeSwatch()

const files = [...layerFiles('docs/gallery'), ...layerFiles('examples')]
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const { png } = await renderLayer(source, { baseDir: dirname(file) })
  const out = file.replace(/\.layer$/, '.png')
  writeFileSync(out, png)
  console.log(out)
}

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBatchPosters } from './posters-batch.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dir = join(root, 'examples', 'batch')
mkdirSync(dir, { recursive: true })
for (const poster of renderBatchPosters()) {
  const file = join(dir, `${poster.id}.fvg`)
  writeFileSync(file, poster.source)
  console.log(file)
}

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderCityJazzPosterVue } from './poster-city-jazz.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outFile = join(root, 'examples', 'poster-city-jazz.layer')
const source = renderCityJazzPosterVue()
writeFileSync(outFile, source, 'utf8')
console.log('Wrote', outFile)

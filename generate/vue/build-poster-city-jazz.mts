import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderCityJazzPosterVue } from './poster-city-jazz.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outFvg = join(root, 'examples', 'poster-city-jazz.fvg')
const source = renderCityJazzPosterVue()
writeFileSync(outFvg, source, 'utf8')
console.log('Wrote', outFvg)

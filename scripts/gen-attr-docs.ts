import { readFileSync, writeFileSync } from 'node:fs'
import { effectCheatLine, ownershipTableBody } from '../src/schema.js'

function fill(path: string, marker: string, body: string) {
  const begin = `<!-- ${marker}:begin -->`
  const end = `<!-- ${marker}:end -->`
  const text = readFileSync(path, 'utf8')
  const start = text.indexOf(begin)
  const stop = text.indexOf(end)
  if (start < 0 || stop < 0 || stop < start) {
    throw new Error(`${path} 缺少 ${begin} / ${end}`)
  }
  const next = `${text.slice(0, start + begin.length)}\n${body}\n${text.slice(stop)}`
  writeFileSync(path, next)
}

fill('SPEC.md', 'attrs:ownership', ownershipTableBody())
fill('docs/CHEATSHEET.md', 'attrs:effects', effectCheatLine())

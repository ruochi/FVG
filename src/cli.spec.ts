import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const helloPath = join(pkgDir, 'examples', 'hello.fvg')

beforeAll(async () => {
  for (const dir of [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('render hello.fvg', () => {
  it('生成 PNG', async () => {
    const source = await readFile(helloPath, 'utf8')
    const { png, report } = await renderFvg(source, {
      baseDir: join(pkgDir, 'examples'),
      fontsCacheDir: join(homedir(), '.cache', 'fvg', 'fonts'),
    })
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
    expect(report.width).toBe(1080)
    expect(report.height).toBe(1920)
    expect(report.elements.length).toBeGreaterThan(0)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'

const FONT_DIRS = [join(homedir(), '.cache', 'fvg', 'fonts'), '/tmp/fvgtest']

beforeAll(async () => {
  for (const dir of FONT_DIRS) {
    if (await initFontsForMeasure({ fontsCacheDir: dir })) break
  }
})

describe('layoutSource', () => {
  it('Layer anchor top-left', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300" background="#fff"><h1 cx="10" cy="10" anchor="top-left">A</h1></fvg>`,
      process.cwd(),
    )
    const h1 = doc.root.children[0]
    expect(h1?.x).toBe(10)
    expect(h1?.y).toBe(10)
  })

  it('线条使用自身坐标，不拉到图层中心', async () => {
    const doc = await layoutSource(
      `<fvg width="800" height="600"><Line x1="100" y1="400" x2="700" y2="400" /><Arrow x1="280" y1="200" x2="420" y2="200" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]
    const arrow = doc.root.children[1]
    expect(line?.kind).toBe('line')
    expect(arrow?.kind).toBe('line')
    expect(line!.y + line!.height / 2).toBeCloseTo(400, 0)
    expect(arrow!.y + arrow!.height / 2).toBeCloseTo(200, 0)
    expect(doc.root.ink.x).toBeGreaterThan(0)
  })

  it('Column 按内容收缩后仍居中', async () => {
    const doc = await layoutSource(
      `<fvg width="1080" height="1920" background="#0f1115" color="#ffffff">
        <Column cx="540" cy="700" style="gap:32px; align-items:center">
          <h1 style="font-size:96px; color:#fff">比特币减半</h1>
          <Row style="gap:24px">
            <div style="padding:16px 28px; background:#f7931a; border-radius:999px; font-size:40px; color:#111">2024</div>
            <div style="padding:16px 28px; border:2px solid #f7931a; border-radius:999px; font-size:40px; color:#fff">3.125 BTC</div>
          </Row>
        </Column>
      </fvg>`,
      process.cwd(),
    )
    const column = doc.root.children[0]
    expect(column?.kind).toBe('flex')
    if (column?.kind !== 'flex') return
    const h1 = column.children[0]
    const row = column.children[1]
    expect(h1?.kind).toBe('text')
    expect(row?.kind).toBe('flex')
    if (h1?.kind !== 'text' || row?.kind !== 'flex') return
    const h1Center = column.x + h1.x + h1.width / 2
    expect(h1Center).toBeCloseTo(540, 0)
    const rowCenter = column.x + row.x + row.width / 2
    expect(rowCenter).toBeCloseTo(540, 0)
    const badge = row.children[1]
    expect(badge?.kind).toBe('text')
    if (badge?.kind !== 'text') return
    const lineText = badge.textLayout.lines.map((line) => line.segments.map((seg) => seg.text).join('')).join('')
    expect(lineText).toBe('3.125 BTC')
    expect(badge.textLayout.lines).toHaveLength(1)
  })

  it('div 里的块级子元素会排出来', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><div cx="200" cy="150" style="width:200px; padding:10px"><h3>标题</h3><p>正文</p></div></fvg>`,
      process.cwd(),
    )
    const card = doc.root.children[0]
    expect(card?.kind).toBe('flex')
    if (card?.kind !== 'flex') return
    const tags = card.children.map((child) => child.tag)
    expect(tags).toEqual(['h3', 'p'])
    const h3 = card.children[0]
    expect(h3?.kind).toBe('text')
    if (h3?.kind !== 'text') return
    expect(h3.textLayout.lines.map((line) => line.segments.map((seg) => seg.text).join('')).join('')).toBe('标题')
  })

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

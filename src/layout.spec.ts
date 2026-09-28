import { beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'
import { buildReport } from './report.js'

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

  it('写死宽度的 Row 保留 justify-content 和 flex-grow', async () => {
    const doc = await layoutSource(
      `<fvg width="800" height="400">
        <Row cx="400" cy="100" style="width:700px; padding:10px; justify-content:space-between">
          <Rect width="80" height="40" /><Rect width="80" height="40" />
        </Row>
        <Row cx="400" cy="300" style="width:700px; padding:10px; gap:10px">
          <Rect width="80" height="40" /><Rect width="80" height="40" style="flex-grow:1" />
        </Row>
      </fvg>`,
      process.cwd(),
    )
    const [spaced, grown] = doc.root.children
    expect(spaced?.kind).toBe('flex')
    expect(grown?.kind).toBe('flex')
    if (spaced?.kind !== 'flex' || grown?.kind !== 'flex') return
    const last = spaced.children[1]!
    expect(last.x + last.width).toBeCloseTo(690, 0)
    expect(grown.children[1]!.width).toBeCloseTo(590, 0)
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

  it('align-self 和 stretch', async () => {
    const doc = await layoutSource(
      `<fvg width="800" height="400">
        <Row style="width:400px; height:120px; padding:10px; align-items:start">
          <Rect width="40" height="40" fill="#e53935" />
          <Rect width="40" height="40" fill="#43a047" style="align-self:end" />
        </Row>
        <Column style="width:400px; padding:10px; align-items:stretch">
          <p style="text-align:center">拉伸</p>
        </Column>
      </fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    const column = doc.root.children[1]
    expect(row?.kind).toBe('flex')
    expect(column?.kind).toBe('flex')
    if (row?.kind !== 'flex' || column?.kind !== 'flex') return
    const endRect = row.children[1]!
    expect(endRect.y).toBeGreaterThan(row.children[0]!.y + 20)
    const text = column.children[0]!
    expect(text.width).toBeGreaterThan(300)
  })

  it('无法解析的属性会警告', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Rect cx="abc" width="100%" height="20" /><p style="font-size:2em">A</p><p style="font-family:NotAFont">B</p></fvg>`,
      process.cwd(),
    )
    const messages = doc.issues.filter((issue) => issue.code === 'invalid-attr').map((issue) => issue.message)
    expect(messages.some((message) => message.includes('cx'))).toBe(true)
    expect(messages.some((message) => message.includes('width'))).toBe(true)
    expect(messages.some((message) => message.includes('font-size'))).toBe(true)
    expect(messages.some((message) => message.includes('NotAFont'))).toBe(true)
  })

  it('Path 按曲线着墨，不按控制点偏移', async () => {
    const doc = await layoutSource(
      `<fvg width="600" height="400"><Path d="M 50 350 Q 300 0 550 350" stroke="#1e88e5" stroke-width="6" /></fvg>`,
      process.cwd(),
    )
    const path = doc.root.children[0]
    expect(path?.kind).toBe('line')
    expect(path!.y).toBeGreaterThan(100)
    expect(buildReport(doc).issues.some((issue) => issue.code === 'overflow-canvas')).toBe(false)
    if (path?.kind === 'line' && path.geometry.kind === 'path') {
      expect(path.geometry.d.startsWith('M 50')).toBe(false)
    }
  })

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })

  it('Image 未写宽高时用原始像素尺寸', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-layout-img-'))
    const tile = createCanvas(32, 24)
    tile.getContext('2d').fillStyle = '#ff0000'
    tile.getContext('2d').fillRect(0, 0, 32, 24)
    await writeFile(join(dir, 'pic.png'), tile.toBuffer('image/png'))
    const doc = await layoutSource(`<fvg width="200" height="200"><Image src="pic.png" /></fvg>`, dir)
    const image = doc.root.children[0]
    expect(image?.kind).toBe('image')
    if (image?.kind !== 'image') return
    expect(image.width).toBe(32)
    expect(image.height).toBe(24)
    expect(image.intrinsicWidth).toBe(32)
    expect(image.intrinsicHeight).toBe(24)
  })

  it('Image 只写 width 时按比例补 height', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-layout-aspect-'))
    const tile = createCanvas(40, 20)
    tile.getContext('2d').fillStyle = '#00ff00'
    tile.getContext('2d').fillRect(0, 0, 40, 20)
    await writeFile(join(dir, 'wide.png'), tile.toBuffer('image/png'))
    const doc = await layoutSource(`<fvg width="200" height="200"><Image src="wide.png" width="80" /></fvg>`, dir)
    const image = doc.root.children[0]
    expect(image?.kind).toBe('image')
    if (image?.kind !== 'image') return
    expect(image.width).toBe(80)
    expect(image.height).toBe(40)
  })

  it('box-shadow 扩大 ink 但不扩大 box', async () => {
    const doc = await layoutSource(
      `<fvg width="100" height="100"><Rect width="20" height="20" fill="#000" style="box-shadow:10px 0px 0px #000" /></fvg>`,
      process.cwd(),
    )
    const rect = doc.root.children[0]
    expect(rect?.width).toBe(20)
    expect(rect?.height).toBe(20)
    expect(rect?.ink.width).toBeGreaterThan(20)
  })

  it('Image 的 object-fit 写错会 invalid-attr', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-bad-fit-'))
    const tile = createCanvas(4, 4)
    const ctx = tile.getContext('2d')
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 4, 4)
    await writeFile(join(dir, 'a.png'), tile.toBuffer('image/png'))
    const doc = await layoutSource(`<fvg width="40" height="40"><Image src="a.png" style="object-fit:stretch" /></fvg>`, dir)
    expect(doc.issues.some((issue) => issue.code === 'invalid-attr' && issue.message.includes('object-fit'))).toBe(true)
  })

  it('dashed 边框解析进布局节点', async () => {
    const doc = await layoutSource(
      `<fvg width="100" height="100"><Layer style="width:40px; height:40px; border:3px dashed #fff" /></fvg>`,
      process.cwd(),
    )
    const layer = doc.root.children[0]
    expect(layer?.border).toEqual({ width: 3, color: '#fff', style: 'dashed' })
    expect(layer?.radii).toEqual({ tl: 0, tr: 0, br: 0, bl: 0 })
  })
})

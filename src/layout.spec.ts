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

  it('线条边界盒', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Line x1="10" y1="10" x2="100" y2="50" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]
    expect(line?.kind).toBe('line')
    expect(line!.width).toBeGreaterThan(0)
  })

  it('Column padding 把子元素往里推', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><Column cx="20" cy="20" anchor="top-left" style="padding:40px; width:200px; align-items:start"><p>Hi</p></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    expect(col?.kind).toBe('flex')
    if (col?.kind !== 'flex') return
    expect(col.children[0]?.x).toBe(40)
    expect(col.children[0]?.y).toBe(40)
  })

  it('invalid-child 线条进 Row', async () => {
    const doc = await layoutSource(
      `<fvg width="200" height="200"><Row><Line x1="0" y1="0" x2="10" y2="10" /></Row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })

  it('形状的尺寸和上色从 style 读', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><Circle cx="100" cy="100" style="r:30px; fill:#e23b2f; stroke:#fff; stroke-width:3px" /></fvg>`,
      process.cwd(),
    )
    const c = doc.root.children[0]
    expect(c?.kind).toBe('shape')
    if (c?.kind !== 'shape') return
    expect(c.width).toBe(60)
    expect(c.fill).toBe('#e23b2f')
    expect(c.strokeWidth).toBe(3)
    expect(doc.width).toBe(400)
    expect(doc.issues).toEqual([])
  })

  it('旧写法照读，并记 legacy-attr', async () => {
    const doc = await layoutSource(`<fvg width="400" height="300"><Circle cx="100" cy="100" r="30" fill="#e23b2f" /></fvg>`, process.cwd())
    const c = doc.root.children[0]
    expect(c?.kind === 'shape' && c.width).toBe(60)
    expect(c?.kind === 'shape' && c.fill).toBe('#e23b2f')
    const legacy = doc.issues.filter((i) => i.code === 'legacy-attr').map((i) => `${i.path} ${i.message.split(' ')[0]}`)
    expect(legacy).toEqual(['fvg width', 'fvg height', 'fvg/Circle[0] r', 'fvg/Circle[0] fill'])
  })

  it('style 优先于旧写法', async () => {
    const doc = await layoutSource(`<fvg style="width:400px; height:300px"><Circle r="10" style="r:30px" /></fvg>`, process.cwd())
    expect(doc.root.children[0]?.width).toBe(60)
    expect(doc.issues.some((i) => i.code === 'legacy-attr')).toBe(false)
  })

  it('flex 子元素写了 cx/cy 记 ignored-position', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><Column><p cx="10" anchor="top-left">Hi</p></Column></fvg>`,
      process.cwd(),
    )
    const ignored = doc.issues.filter((i) => i.code === 'ignored-position')
    expect(ignored.map((i) => i.path)).toEqual(['fvg/Column[0]/p[0]', 'fvg/Column[0]/p[0]'])
  })

  it('用不上的 style 记 unused-style', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><Circle style="r:10px; font-size:20px" /><Row><Rect style="width:10px; height:10px; flex-grow:1" /></Row></fvg>`,
      process.cwd(),
    )
    const unused = doc.issues.filter((i) => i.code === 'unused-style')
    expect(unused.map((i) => i.message)).toEqual(['style 里的 font-size 对 Circle 无效'])
  })

  it('阴影和光晕补全默认值，光晕颜色取本体', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><Rect style="width:10px; height:10px; fill:#e23b2f; shadow:0 4px; glow:8px" /><p style="color:#00ff00; glow:6px 2px">Hi</p></fvg>`,
      process.cwd(),
    )
    const [rect, text] = doc.root.children
    expect(rect?.shadow).toEqual({ x: 0, y: 4, blur: 0, spread: 0, color: '#00000066' })
    expect(rect?.glow).toEqual({ blur: 8, spread: 0, color: '#e23b2f' })
    expect(text?.glow).toEqual({ blur: 6, spread: 2, color: '#00ff00' })
  })

  it('无法解析的 shadow 记 invalid-attr', async () => {
    const doc = await layoutSource(`<fvg style="width:400px; height:300px"><Rect style="width:10px; height:10px; shadow:big" /></fvg>`, process.cwd())
    expect(doc.root.children[0]?.shadow).toBeUndefined()
    expect(doc.issues.some((i) => i.code === 'invalid-attr')).toBe(true)
  })

  it('Layer 里的线条按自己的坐标放，不被挪到中心', async () => {
    const doc = await layoutSource(
      `<fvg style="width:800px; height:600px"><Line x1="100" y1="400" x2="700" y2="400" style="stroke-width:2px" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]!
    expect(line.x).toBeLessThan(100)
    expect(line.x + line.width).toBeGreaterThan(700)
    expect(line.y).toBeLessThan(400)
  })

  it('没写宽度的 Column 按内容定宽，居中的子元素落在中线上', async () => {
    const doc = await layoutSource(
      `<fvg style="width:1080px; height:800px"><Column cx="540" cy="400"><Rect style="width:400px; height:10px" /><Rect style="width:100px; height:10px" /></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    if (col?.kind !== 'flex') throw new Error('expected flex')
    expect(col.width).toBe(400)
    const small = col.children[1]!
    expect(col.x + small.x + small.width / 2).toBe(540)
  })

  it('Column 定宽时文字换行，列高跟着变', async () => {
    const doc = await layoutSource(
      `<fvg style="width:1080px; height:800px"><Column style="width:200px; align-items:start"><p style="font-size:40px">区块奖励减少一半大约每四年发生一次</p></Column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    if (col?.kind !== 'flex') throw new Error('expected flex')
    const p = col.children[0]
    if (p?.kind !== 'text') throw new Error('expected text')
    expect(p.width).toBeLessThanOrEqual(200)
    expect(p.textLayout.lines.length).toBeGreaterThan(1)
    expect(col.height).toBeCloseTo(p.height)
  })

  it('词之间的空格保留', async () => {
    const doc = await layoutSource(`<fvg style="width:400px; height:300px"><p style="white-space:nowrap">3.125 BTC</p></fvg>`, process.cwd())
    const p = doc.root.children[0]
    if (p?.kind !== 'text') throw new Error('expected text')
    expect(p.textLayout.lines.map((l) => l.segments.map((s) => s.text).join(''))).toEqual(['3.125 BTC'])
  })
})

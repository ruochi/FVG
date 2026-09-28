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
  it('layer anchor top-left', async () => {
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
      `<fvg width="200" height="200"><line x1="10" y1="10" x2="100" y2="50" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]
    expect(line?.kind).toBe('line')
    expect(line!.width).toBeGreaterThan(0)
  })

  it('column padding 把子元素往里推', async () => {
    const doc = await layoutSource(
      `<fvg width="400" height="300"><column cx="20" cy="20" anchor="top-left" style="padding:40px; width:200px; align-items:start"><p>Hi</p></column></fvg>`,
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
      `<fvg width="200" height="200"><row><line x1="0" y1="0" x2="10" y2="10" /></row></fvg>`,
      process.cwd(),
    )
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })

  it('大写 Circle 解析为 circle，并按中心布局', async () => {
    const doc = await layoutSource(
      `<fvg style="width:200px; height:200px"><Circle cx="40" cy="50" style="r:10px" /></fvg>`,
      process.cwd(),
    )
    const circle = doc.root.children[0]
    expect(circle?.tag).toBe('circle')
    expect(circle?.x).toBe(30)
    expect(circle?.y).toBe(40)
    expect(circle?.width).toBe(20)
  })

  it('形状的尺寸和上色从 style 读', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><circle cx="100" cy="100" style="r:30px; fill:#e23b2f; stroke:#fff; stroke-width:3px" /></fvg>`,
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
    const doc = await layoutSource(`<fvg width="400" height="300"><circle cx="100" cy="100" r="30" fill="#e23b2f" /></fvg>`, process.cwd())
    const c = doc.root.children[0]
    expect(c?.kind === 'shape' && c.width).toBe(60)
    expect(c?.kind === 'shape' && c.fill).toBe('#e23b2f')
    const legacy = doc.issues.filter((i) => i.code === 'legacy-attr').map((i) => `${i.path} ${i.message.split(' ')[0]}`)
    expect(legacy).toEqual(['fvg width', 'fvg height', 'fvg/circle[0] r', 'fvg/circle[0] fill'])
  })

  it('style 优先于旧写法', async () => {
    const doc = await layoutSource(`<fvg style="width:400px; height:300px"><circle r="10" style="r:30px" /></fvg>`, process.cwd())
    expect(doc.root.children[0]?.width).toBe(60)
    expect(doc.issues.some((i) => i.code === 'legacy-attr')).toBe(false)
  })

  it('flex 子元素写了 cx/cy 记 ignored-position', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><column><p cx="10" anchor="top-left">Hi</p></column></fvg>`,
      process.cwd(),
    )
    const ignored = doc.issues.filter((i) => i.code === 'ignored-position')
    expect(ignored.map((i) => i.path)).toEqual(['fvg/column[0]/p[0]', 'fvg/column[0]/p[0]'])
  })

  it('用不上的 style 记 unused-style', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><circle style="r:10px; font-size:20px" /><row><rect style="width:10px; height:10px; flex-grow:1" /></row></fvg>`,
      process.cwd(),
    )
    const unused = doc.issues.filter((i) => i.code === 'unused-style')
    expect(unused.map((i) => i.message)).toEqual(['style 里的 font-size 对 circle 无效'])
  })

  it('阴影和光晕补全默认值，光晕颜色取本体', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><rect style="width:10px; height:10px; fill:#e23b2f; shadow:0 4px; glow:8px" /><p style="color:#00ff00; glow:6px 2px">Hi</p></fvg>`,
      process.cwd(),
    )
    const [rect, text] = doc.root.children
    expect(rect?.shadow).toEqual({ x: 0, y: 4, blur: 0, spread: 0, color: '#00000066' })
    expect(rect?.glow).toEqual({ blur: 8, spread: 0, color: '#e23b2f' })
    expect(text?.glow).toEqual({ blur: 6, spread: 2, color: '#00ff00' })
  })

  it('写在标签上的 glow 和 shadow 仍然生效', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px"><circle cx="80" cy="80" glow="40px" shadow="0 8px" style="r:30px; fill:#fff" /></fvg>`,
      process.cwd(),
    )
    const c = doc.root.children[0]
    expect(c?.glow).toEqual({ blur: 40, spread: 0, color: '#fff' })
    expect(c?.shadow).toEqual({ x: 0, y: 8, blur: 0, spread: 0, color: '#00000066' })
    expect(doc.issues.filter((i) => i.code === 'legacy-attr').map((i) => i.message.split(' ')[0]).sort()).toEqual(['glow', 'shadow'])
  })

  it('无法解析的 shadow 记 invalid-attr', async () => {
    const doc = await layoutSource(`<fvg style="width:400px; height:300px"><rect style="width:10px; height:10px; shadow:big" /></fvg>`, process.cwd())
    expect(doc.root.children[0]?.shadow).toBeUndefined()
    expect(doc.issues.some((i) => i.code === 'invalid-attr')).toBe(true)
  })

  it('layer 里的线条按自己的坐标放，不被挪到中心', async () => {
    const doc = await layoutSource(
      `<fvg style="width:800px; height:600px"><line x1="100" y1="400" x2="700" y2="400" style="stroke-width:2px" /></fvg>`,
      process.cwd(),
    )
    const line = doc.root.children[0]!
    expect(line.x).toBeLessThan(100)
    expect(line.x + line.width).toBeGreaterThan(700)
    expect(line.y).toBeLessThan(400)
  })

  it('没写宽度的 column 按内容定宽，居中的子元素落在中线上', async () => {
    const doc = await layoutSource(
      `<fvg style="width:1080px; height:800px"><column cx="540" cy="400"><rect style="width:400px; height:10px" /><rect style="width:100px; height:10px" /></column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    if (col?.kind !== 'flex') throw new Error('expected flex')
    expect(col.width).toBe(400)
    const small = col.children[1]!
    expect(col.x + small.x + small.width / 2).toBe(540)
  })

  it('column 定宽时文字换行，列高跟着变', async () => {
    const doc = await layoutSource(
      `<fvg style="width:1080px; height:800px"><column style="width:200px; align-items:start"><p style="font-size:40px">区块奖励减少一半大约每四年发生一次</p></column></fvg>`,
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

  it('column 的 gap 就是两段字的着墨间距', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:400px"><column style="gap:6px; align-items:start"><p style="font-size:40px">霜降</p><p style="font-size:36px">夜读</p></column></fvg>`,
      process.cwd(),
    )
    const col = doc.root.children[0]
    if (col?.kind !== 'flex') throw new Error('expected flex')
    const a = col.children[0]
    const b = col.children[1]
    if (a?.kind !== 'text' || b?.kind !== 'text') throw new Error('expected text')
    const gap = b.y + b.ink.y - (a.y + a.ink.y + a.ink.height)
    expect(gap).toBeCloseTo(6, 0)
  })

  it('row 里单行文字不会因为宽度取整被拆成两行', async () => {
    const doc = await layoutSource(
      `<fvg style="width:1080px; height:400px"><row style="width:936px; gap:28px; align-items:center"><p style="font-size:32px; width:120px">20:15</p><p style="font-size:34px">Sax &amp; Keys</p></row></fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    if (row?.kind !== 'flex') throw new Error('expected flex')
    const act = row.children[1]
    if (act?.kind !== 'text') throw new Error('expected text')
    expect(act.textLayout.lines).toHaveLength(1)
    expect(act.textLayout.autoWrap).toBe(false)
  })

  it('写死宽度的 row 保留 justify-content 和 flex-grow', async () => {
    const doc = await layoutSource(
      `<fvg style="width:800px; height:400px">
        <row cx="400" cy="100" style="width:700px; padding:10px; justify-content:space-between">
          <rect style="width:80px; height:40px" /><rect style="width:80px; height:40px" />
        </row>
        <row cx="400" cy="300" style="width:700px; padding:10px; gap:10px">
          <rect style="width:80px; height:40px" /><rect style="width:80px; height:40px; flex-grow:1" />
        </row>
      </fvg>`,
      process.cwd(),
    )
    const spaced = doc.root.children[0]
    const grown = doc.root.children[1]
    if (spaced?.kind !== 'flex' || grown?.kind !== 'flex') throw new Error('expected flex')
    const last = spaced.children[1]!
    expect(last.x + last.width).toBeCloseTo(690, 0)
    expect(grown.children[1]!.width).toBeCloseTo(590, 0)
  })

  it('align-self 和 stretch 改变交叉轴', async () => {
    const doc = await layoutSource(
      `<fvg style="width:800px; height:400px">
        <row style="width:400px; height:120px; padding:10px; align-items:start">
          <rect style="width:40px; height:40px" />
          <rect style="width:40px; height:40px; align-self:end" />
        </row>
        <column style="width:400px; padding:10px; align-items:stretch">
          <p style="text-align:center">拉伸</p>
        </column>
      </fvg>`,
      process.cwd(),
    )
    const row = doc.root.children[0]
    const column = doc.root.children[1]
    if (row?.kind !== 'flex' || column?.kind !== 'flex') throw new Error('expected flex')
    expect(row.children[1]!.y).toBeGreaterThan(row.children[0]!.y + 20)
    expect(column.children[0]!.width).toBeGreaterThan(300)
  })

  it('curve 用 points，开口不填充，闭合才填充', async () => {
    const doc = await layoutSource(
      `<fvg style="width:400px; height:300px">
        <curve points="30,100 100,40 170,100" style="fill:#ff0000; stroke:#ffff00" />
        <curve points="40,40 160,40 100,140" closed style="fill:#00ff00; stroke:none" />
        <row><curve points="0,0 10,10" /></row>
      </fvg>`,
      process.cwd(),
    )
    const open = doc.root.children[0]
    const closed = doc.root.children[1]
    if (open?.kind !== 'line' || closed?.kind !== 'line') throw new Error('expected line')
    expect(open.tag).toBe('curve')
    expect(open.fill).toBe('none')
    expect(open.geometry.kind).toBe('path')
    if (open.geometry.kind === 'path') expect(open.geometry.d.startsWith('M 30 100')).toBe(true)
    expect(open.x).toBeLessThan(40)
    expect(closed.fill).toBe('#00ff00')
    expect(doc.issues.some((i) => i.code === 'open-curve-fill')).toBe(true)
    expect(doc.issues.some((i) => i.code === 'invalid-child')).toBe(true)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { initFontsForMeasure } from './fonts.js'
import { layoutSource } from './layout.js'
import { renderFvg } from './render.js'
import { pixelsFromPng } from './testPixels.js'

const fonts = join(homedir(), '.cache', 'fvg', 'fonts')

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: fonts })
})

async function writeStripePng(dir: string, name: string, w: number, h: number) {
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, w, Math.ceil(h / 2))
  ctx.fillStyle = '#0000ff'
  ctx.fillRect(0, Math.floor(h / 2), w, Math.ceil(h / 2))
  await writeFile(join(dir, name), canvas.toBuffer('image/png'))
}

describe('paint effects', () => {
  it('text-stroke：白字黑描边在字形外侧留下黑像素', async () => {
    const source = `<fvg width="180" height="100" background="#ffffff" color="#ffffff">
      <h1 style="font-size:64px; text-stroke:6px #000000">A</h1>
    </fvg>`
    const { png } = await renderFvg(source, { fontsCacheDir: fonts })
    const img = await pixelsFromPng(png)
    let black = 0
    let white = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = img.at(x, y)
        if (r < 40 && g < 40 && b < 40) black++
        if (r > 240 && g > 240 && b > 240) white++
      }
    }
    expect(black).toBeGreaterThan(30)
    expect(white).toBeGreaterThan(20)
  })

  it('text-stroke：行内 span 也能描边', async () => {
    const source = `<fvg width="220" height="80" background="#ffffff" color="#ffffff">
      <p style="font-size:48px"><span style="text-stroke:4px #000000">描</span></p>
    </fvg>`
    const { png } = await renderFvg(source, { fontsCacheDir: fonts })
    const img = await pixelsFromPng(png)
    let black = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = img.at(x, y)
        if (r < 40 && g < 40 && b < 40) black++
      }
    }
    expect(black).toBeGreaterThan(20)
  })

  it('text-shadow：阴影出现在偏移方向，布局 box 不变', async () => {
    const plain = `<fvg width="220" height="140" background="#ffffff" color="#000000"><p style="font-size:64px">字</p></fvg>`
    const shadowed = `<fvg width="220" height="140" background="#ffffff" color="#000000"><p style="font-size:64px; text-shadow:0px 18px 0px rgba(255,0,0,0.55)">字</p></fvg>`
    const plainReport = (await renderFvg(plain, { fontsCacheDir: fonts })).report
    const { png, report } = await renderFvg(shadowed, { fontsCacheDir: fonts })
    const plainBox = plainReport.elements.find((el) => el.tag === 'p')!
    const shadowBox = report.elements.find((el) => el.tag === 'p')!
    expect(shadowBox.box.width).toBe(plainBox.box.width)
    expect(shadowBox.box.height).toBe(plainBox.box.height)
    expect(shadowBox.ink.bottom).toBeGreaterThan(shadowBox.box.bottom)
    const img = await pixelsFromPng(png)
    let blackBottom = 0
    let pinkBottom = 0
    let pink = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = img.at(x, y)
        if (r < 40 && g < 40 && b < 40) blackBottom = Math.max(blackBottom, y)
        if (r > 200 && g > 70 && g < 190 && b > 70 && b < 190) {
          pink++
          pinkBottom = Math.max(pinkBottom, y)
        }
      }
    }
    expect(pink).toBeGreaterThan(20)
    expect(pinkBottom).toBeGreaterThan(blackBottom)
  })

  it('box-shadow：偏移方向有半透明像素，box 不变、ink 变宽', async () => {
    const source = `<fvg width="120" height="80" background="#ffffff">
      <Rect width="40" height="40" fill="#000000" style="box-shadow:16px 0px 0px rgba(0,0,255,0.6)" />
    </fvg>`
    const { png, report } = await renderFvg(source, { fontsCacheDir: fonts })
    const rect = report.elements.find((el) => el.tag === 'Rect')!
    expect(rect.box.width).toBe(40)
    expect(rect.box.height).toBe(40)
    expect(rect.ink.width).toBeGreaterThan(rect.box.width)
    const img = await pixelsFromPng(png)
    const [r, g, b] = img.at(86, 40)
    expect(r).toBeGreaterThan(60)
    expect(r).toBeLessThan(180)
    expect(g).toBeGreaterThan(60)
    expect(g).toBeLessThan(180)
    expect(b).toBeGreaterThan(220)
  })

  it('linear-gradient：从左到右由黑变白', async () => {
    const source = `<fvg width="100" height="20" background="#ffffff">
      <Rect width="100" height="20" fill="linear-gradient(90deg, #000000, #ffffff)" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    expect(img.at(2, 10)[0]).toBeLessThan(40)
    expect(img.at(97, 10)[0]).toBeGreaterThan(220)
  })

  it('radial-gradient：中心亮、角落暗', async () => {
    const source = `<fvg width="80" height="80" background="#ffffff">
      <Rect width="80" height="80" fill="radial-gradient(circle, #ffffff, #000000)" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    expect(img.at(40, 40)[0]).toBeGreaterThan(img.at(2, 2)[0] + 80)
    expect(img.at(2, 2)[0]).toBeLessThan(40)
  })

  it('容器 background 线性渐变', async () => {
    const source = `<fvg width="60" height="20" background="#ffffff">
      <Layer style="width:60px; height:20px; background:linear-gradient(90deg, #000000, #ffffff)" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    expect(img.at(2, 10)[0]).toBeLessThan(40)
    expect(img.at(57, 10)[0]).toBeGreaterThan(220)
  })

  it('dashed 边框沿边缘有间断', async () => {
    const source = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:60px; height:40px; border:4px dashed #000000" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    let dark = 0
    let light = 0
    for (let x = 16; x < 64; x++) {
      const [r] = img.at(x, 20)
      if (r < 80) dark++
      else if (r > 200) light++
    }
    expect(dark).toBeGreaterThan(8)
    expect(light).toBeGreaterThan(8)
  })

  it('dotted 边框沿边缘有圆点间断', async () => {
    const source = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:60px; height:40px; border:4px dotted #000000" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    let dark = 0
    let light = 0
    for (let x = 16; x < 64; x++) {
      const [r] = img.at(x, 20)
      if (r < 80) dark++
      else if (r > 200) light++
    }
    expect(dark).toBeGreaterThan(4)
    expect(light).toBeGreaterThan(20)
  })

  it('border-radius 四角：只有左上角是圆的', async () => {
    const source = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:40px; height:40px; background:#000000; border-radius:18px 0px 0px 0px" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)
    expect(img.at(20, 20)[0]).toBeGreaterThan(240)
    expect(img.at(59, 20)[0]).toBeLessThan(20)
    expect(img.at(59, 59)[0]).toBeLessThan(20)
    expect(img.at(20, 59)[0]).toBeLessThan(20)
  })

  it('Image cover：宽图裁切后红上蓝下', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-cover-'))
    await writeStripePng(dir, 'wide.png', 20, 10)
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Image src="wide.png" width="20" height="20" cx="20" cy="20" anchor="center" style="object-fit:cover" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })).png)
    expect(img.at(20, 8)[0]).toBeGreaterThan(200)
    expect(img.at(20, 32)[2]).toBeGreaterThan(200)
  })

  it('Image contain：整图放进盒子，上下留白', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-contain-'))
    await writeStripePng(dir, 'wide.png', 20, 10)
    const source = `<fvg width="40" height="40" background="#111111">
      <Image src="wide.png" width="20" height="20" cx="20" cy="20" anchor="center" style="object-fit:contain" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })).png)
    expect(img.at(20, 11)[0]).toBeLessThan(30)
    expect(img.at(20, 18)[0]).toBeGreaterThan(200)
    expect(img.at(20, 24)[2]).toBeGreaterThan(200)
    expect(img.at(20, 33)[0]).toBeLessThan(30)
  })

  it('Image fill：拉伸到盒子宽高', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-fill-'))
    await writeStripePng(dir, 'wide.png', 20, 10)
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Image src="wide.png" width="20" height="20" cx="20" cy="20" anchor="center" style="object-fit:fill" />
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })).png)
    expect(img.at(20, 5)[0]).toBeGreaterThan(200)
    expect(img.at(20, 35)[2]).toBeGreaterThan(200)
  })

  it('Image 缺文件：missing-image 警告且不抛错', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-missing-'))
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Image src="nope.png" width="16" height="16" />
    </fvg>`
    const { png, report } = await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })
    expect(report.issues.some((issue) => issue.code === 'missing-image')).toBe(true)
    const img = await pixelsFromPng(png)
    expect(img.at(20, 20)[0]).toBeGreaterThan(240)
  })

  it('Image 在 Row 里参与排列', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-row-img-'))
    const tile = createCanvas(8, 8)
    const tileCtx = tile.getContext('2d')
    tileCtx.fillStyle = '#00ff00'
    tileCtx.fillRect(0, 0, 8, 8)
    await writeFile(join(dir, 'icon.png'), tile.toBuffer('image/png'))
    const doc = await layoutSource(
      `<fvg width="200" height="60"><Row style="gap:8px"><Image src="icon.png" width="16" height="16" /><Rect width="16" height="16" fill="#ff0000" /></Row></fvg>`,
      dir,
    )
    const row = doc.root.children[0]
    expect(row?.kind).toBe('flex')
    if (row?.kind !== 'flex') return
    const image = row.children[0]
    const rect = row.children[1]
    expect(image?.kind).toBe('image')
    expect(image?.width).toBe(16)
    expect(rect?.x).toBeGreaterThan(image!.x)
  })

  it('overflow:hidden + 圆角：方图角被裁成背景色', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-clip-'))
    const tile = createCanvas(40, 40)
    const tileCtx = tile.getContext('2d')
    tileCtx.fillStyle = '#ff0000'
    tileCtx.fillRect(0, 0, 40, 40)
    await writeFile(join(dir, 'face.png'), tile.toBuffer('image/png'))
    const source = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:40px; height:40px; border-radius:20px; overflow:hidden">
        <Image src="face.png" width="40" height="40" style="object-fit:cover" />
      </Layer>
    </fvg>`
    const img = await pixelsFromPng((await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })).png)
    expect(img.at(20, 20)[0]).toBeGreaterThan(240)
    expect(img.at(40, 40)[0]).toBeGreaterThan(200)
    expect(img.at(40, 40)[1]).toBeLessThan(40)
  })

  it('z-index：数值大的盖住小的', async () => {
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Rect width="40" height="40" fill="#ff0000" style="z-index:2" />
      <Rect width="40" height="40" fill="#0000ff" style="z-index:1" />
    </fvg>`
    const [r, , b] = (await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)).at(20, 20)
    expect(r).toBeGreaterThan(200)
    expect(b).toBeLessThan(40)
  })

  it('z-index 相同：后写的画在上面', async () => {
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Rect width="40" height="40" fill="#ff0000" style="z-index:0" />
      <Rect width="40" height="40" fill="#0000ff" style="z-index:0" />
    </fvg>`
    const [r, , b] = (await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)).at(20, 20)
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(40)
  })

  it('z-index 在 Row 子元素间生效', async () => {
    const source = `<fvg width="80" height="40" background="#ffffff">
      <Row style="width:80px; height:40px">
        <Rect width="40" height="40" fill="#0000ff" style="z-index:1" />
        <Rect width="40" height="40" fill="#ff0000" style="z-index:2" />
      </Row>
    </fvg>`
    const [r, , b] = (await pixelsFromPng((await renderFvg(source, { fontsCacheDir: fonts })).png)).at(60, 20)
    expect(r).toBeGreaterThan(200)
    expect(b).toBeLessThan(40)
  })

  it('无法解析的渐变和 z-index 记 invalid-attr', async () => {
    const doc = await layoutSource(
      `<fvg width="20" height="20"><Rect width="10" height="10" fill="linear-gradient(nope)" style="z-index:nope" /><Layer style="overflow:clip" /></fvg>`,
      process.cwd(),
    )
    const labels = doc.issues.filter((issue) => issue.code === 'invalid-attr').map((issue) => issue.message)
    expect(labels.some((message) => message.includes('fill'))).toBe(true)
    expect(labels.some((message) => message.includes('z-index'))).toBe(true)
    expect(labels.some((message) => message.includes('overflow'))).toBe(true)
  })
})

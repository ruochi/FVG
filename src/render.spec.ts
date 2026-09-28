import { beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { initFontsForMeasure } from './fonts.js'
import { renderFvg } from './render.js'

const pkgDir = join(fileURLToPath(import.meta.url), '..', '..')
const fonts = join(homedir(), '.cache', 'fvg', 'fonts')

beforeAll(async () => {
  await initFontsForMeasure({ fontsCacheDir: fonts })
})

async function pixels(png: Buffer) {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  return {
    width: img.width,
    height: img.height,
    at(x: number, y: number) {
      const i = (y * img.width + x) * 4
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const
    },
  }
}

describe('render placement', () => {
  it('虚线、平头和旋转能画出来', async () => {
    const source = `<fvg width="220" height="220" background="#ffffff" color="#000000">
      <Line x1="20" y1="20" x2="200" y2="20" stroke-width="4" stroke-dasharray="12 12" />
      <Line x1="30" y1="70" x2="190" y2="70" stroke-width="20" stroke-linecap="butt" />
      <Row cx="110" cy="150" rotate="90" style="width:100px; height:16px; background:#000000" />
    </fvg>`
    const { png } = await renderFvg(source, { fontsCacheDir: fonts })
    const img = await pixels(png)
    let dark = 0
    let light = 0
    for (let x = 30; x < 190; x++) {
      const [r] = img.at(x, 20)
      if (r < 40) dark++
      else light++
    }
    expect(dark).toBeGreaterThan(20)
    expect(light).toBeGreaterThan(20)
    const cap = img.at(22, 70)
    expect(cap[0]).toBeGreaterThan(240)
    const rotated = img.at(110, 110)
    const unrotated = img.at(40, 150)
    expect(rotated[0]).toBeLessThan(40)
    expect(unrotated[0]).toBeGreaterThan(240)
  })

  it('hello 的标签画在中部，不贴在左上角', async () => {
    const source = await readFile(join(pkgDir, 'examples/hello.fvg'), 'utf8')
    const { png } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    const img = await pixels(png)
    let minY = img.height
    let maxY = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x += 2) {
        const [r, g, b] = img.at(x, y)
        if (r > 200 && g > 100 && g < 190 && b < 60) {
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    expect(minY).toBeGreaterThan(400)
    expect(maxY).toBeGreaterThan(1100)
  })

  it('线条留在写出的坐标上', async () => {
    const source = await readFile(join(pkgDir, 'examples/layer-shapes.fvg'), 'utf8')
    const { png } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    const img = await pixels(png)
    const arrow = img.at(350, 200)
    const line = img.at(400, 400)
    const gap = img.at(400, 300)
    expect(arrow[0]).toBeLessThan(80)
    expect(line[0]).toBeGreaterThan(180)
    expect(line[0]).toBeLessThan(230)
    expect(gap[0]).toBeGreaterThan(250)
    expect(gap[1]).toBeGreaterThan(250)
    expect(gap[2]).toBeGreaterThan(250)
  })

  it('卡片文字画在画面中部', async () => {
    const source = await readFile(join(pkgDir, 'examples/card-row.fvg'), 'utf8')
    const { png, report } = await renderFvg(source, { baseDir: join(pkgDir, 'examples'), fontsCacheDir: fonts })
    expect(report.issues.some((issue) => issue.code === 'min-font-size')).toBe(false)
    const img = await pixels(png)
    let minY = img.height
    let maxY = 0
    let count = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x += 2) {
        const [r, g, b] = img.at(x, y)
        const dark = r < 80 && g < 80 && b < 80
        const orange = r > 200 && g > 100 && g < 190 && b < 80
        if (dark || orange) {
          count++
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    expect(count).toBeGreaterThan(20)
    expect(minY).toBeGreaterThan(200)
    expect((minY + maxY) / 2).toBeGreaterThan(300)
    expect((minY + maxY) / 2).toBeLessThan(500)
  })

  it('白字黑描边在字形外侧留下黑像素', async () => {
    const source = `<fvg width="180" height="100" background="#ffffff" color="#ffffff">
      <h1 style="font-size:64px; text-stroke:6px #000000">A</h1>
    </fvg>`
    const { png } = await renderFvg(source, { fontsCacheDir: fonts })
    const img = await pixels(png)
    let black = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = img.at(x, y)
        if (r < 40 && g < 40 && b < 40) black++
      }
    }
    expect(black).toBeGreaterThan(30)
  })

  it('文字阴影和盒子阴影出现在偏移方向，且不撑大布局盒子', async () => {
    const plain = `<fvg width="220" height="140" background="#ffffff" color="#000000"><p style="font-size:64px">字</p></fvg>`
    const shadowed = `<fvg width="220" height="140" background="#ffffff" color="#000000"><p style="font-size:64px; text-shadow:0px 18px 0px rgba(255,0,0,0.55)">字</p></fvg>`
    const plainReport = (await renderFvg(plain, { fontsCacheDir: fonts })).report
    const { png, report } = await renderFvg(shadowed, { fontsCacheDir: fonts })
    const plainBox = plainReport.elements.find((el) => el.tag === 'p')!
    const shadowBox = report.elements.find((el) => el.tag === 'p')!
    expect(shadowBox.box.width).toBe(plainBox.box.width)
    expect(shadowBox.box.height).toBe(plainBox.box.height)
    const img = await pixels(png)
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

    const box = `<fvg width="120" height="80" background="#ffffff">
      <Rect width="40" height="40" fill="#000000" style="box-shadow:16px 0px 0px rgba(0,0,255,0.6)" />
    </fvg>`
    const boxed = await renderFvg(box, { fontsCacheDir: fonts })
    const rect = boxed.report.elements.find((el) => el.tag === 'Rect')!
    expect(rect.box.width).toBe(40)
    expect(rect.ink.width).toBeGreaterThan(rect.box.width)
    const shadowImg = await pixels(boxed.png)
    const [r, g, b] = shadowImg.at(86, 40)
    expect(r).toBeGreaterThan(60)
    expect(r).toBeLessThan(180)
    expect(g).toBeGreaterThan(60)
    expect(g).toBeLessThan(180)
    expect(b).toBeGreaterThan(220)
  })

  it('线性渐变从左到右变色，径向渐变中心亮边缘暗', async () => {
    const linear = `<fvg width="100" height="20" background="#ffffff">
      <Rect width="100" height="20" fill="linear-gradient(90deg, #000000, #ffffff)" />
    </fvg>`
    const linearImg = await pixels((await renderFvg(linear, { fontsCacheDir: fonts })).png)
    const left = linearImg.at(2, 10)[0]!
    const right = linearImg.at(97, 10)[0]!
    expect(right).toBeGreaterThan(left + 80)

    const radial = `<fvg width="80" height="80" background="#ffffff">
      <Rect width="80" height="80" fill="radial-gradient(circle, #ffffff, #000000)" />
    </fvg>`
    const radialImg = await pixels((await renderFvg(radial, { fontsCacheDir: fonts })).png)
    expect(radialImg.at(40, 40)[0]).toBeGreaterThan(radialImg.at(2, 2)[0] + 80)
  })

  it('虚线边框有间断，四个角可以分别圆', async () => {
    const dashed = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:60px; height:40px; border:4px dashed #000000" />
    </fvg>`
    const dashImg = await pixels((await renderFvg(dashed, { fontsCacheDir: fonts })).png)
    let dark = 0
    let light = 0
    for (let x = 16; x < 64; x++) {
      const [r] = dashImg.at(x, 20)
      if (r < 80) dark++
      else if (r > 200) light++
    }
    expect(dark).toBeGreaterThan(8)
    expect(light).toBeGreaterThan(8)

    const corners = `<fvg width="80" height="80" background="#ffffff">
      <Layer style="width:40px; height:40px; background:#000000; border-radius:18px 0px 0px 0px" />
    </fvg>`
    const cornerImg = await pixels((await renderFvg(corners, { fontsCacheDir: fonts })).png)
    expect(cornerImg.at(20, 20)[0]).toBeGreaterThan(240)
    expect(cornerImg.at(59, 20)[0]).toBeLessThan(20)
    expect(cornerImg.at(59, 59)[0]).toBeLessThan(20)
    expect(cornerImg.at(20, 59)[0]).toBeLessThan(20)
  })

  it('本地小图按 cover 铺满，缺文件只警告', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-img-'))
    const wide = createCanvas(20, 10)
    const wideCtx = wide.getContext('2d')
    wideCtx.fillStyle = '#ff0000'
    wideCtx.fillRect(0, 0, 20, 5)
    wideCtx.fillStyle = '#0000ff'
    wideCtx.fillRect(0, 5, 20, 5)
    await writeFile(join(dir, 'wide.png'), wide.toBuffer('image/png'))
    const tiny = createCanvas(4, 4)
    const tinyCtx = tiny.getContext('2d')
    tinyCtx.fillStyle = '#00ff00'
    tinyCtx.fillRect(0, 0, 4, 4)
    await writeFile(join(dir, 'tiny.png'), tiny.toBuffer('image/png'))
    const source = `<fvg width="80" height="40" background="#ffffff">
      <Image src="wide.png" width="20" height="20" cx="16" cy="20" anchor="center" style="object-fit:cover" />
      <Image src="tiny.png" width="16" height="16" cx="56" cy="20" anchor="center" style="object-fit:cover" />
      <Image src="missing.png" width="8" height="8" cx="4" cy="4" anchor="top-left" />
    </fvg>`
    const { png, report } = await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })
    expect(report.issues.some((issue) => issue.code === 'missing-image')).toBe(true)
    const img = await pixels(png)
    expect(img.at(16, 12)[0]).toBeGreaterThan(200)
    expect(img.at(16, 28)[2]).toBeGreaterThan(200)
    expect(img.at(56, 20)[1]).toBeGreaterThan(200)
    expect(img.at(0, 0)[0]).toBeGreaterThan(240)
  })

  it('圆形 overflow:hidden 裁掉方图的角', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fvg-avatar-'))
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
    const img = await pixels((await renderFvg(source, { baseDir: dir, fontsCacheDir: fonts })).png)
    expect(img.at(20, 20)[0]).toBeGreaterThan(240)
    expect(img.at(40, 40)[0]).toBeGreaterThan(200)
    expect(img.at(40, 40)[1]).toBeLessThan(40)
  })

  it('后写但 z-index 更小的元素画在下面', async () => {
    const source = `<fvg width="40" height="40" background="#ffffff">
      <Rect width="40" height="40" fill="#ff0000" style="z-index:2" />
      <Rect width="40" height="40" fill="#0000ff" style="z-index:1" />
    </fvg>`
    const { png, report } = await renderFvg(source, { fontsCacheDir: fonts })
    const [r, g, b] = (await pixels(png)).at(20, 20)
    expect(r).toBeGreaterThan(200)
    expect(b).toBeLessThan(40)
    expect(g).toBeLessThan(40)
    const bad = `<fvg width="20" height="20"><Rect width="10" height="10" fill="linear-gradient(nope)" style="z-index:nope" /></fvg>`
    const checked = await renderFvg(bad, { fontsCacheDir: fonts })
    expect(checked.report.issues.some((issue) => issue.code === 'invalid-attr')).toBe(true)
    expect(report.issues.some((issue) => issue.code === 'missing-image')).toBe(false)
  })
})

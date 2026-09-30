import { describe, expect, it } from 'vitest'
import { checkFvg } from './render.js'

async function issues(source: string) {
  const report = await checkFvg(source)
  return report
}

describe('属性归属', () => {
  it('flex 子元素写 cx 报 warn 并带 hint', async () => {
    const report = await issues(`<fvg width="400" height="200"><div style="display:flex"><p cx="10" cy="10">甲</p></div></fvg>`)
    const hit = report.issues.find((issue) => issue.code === 'invalid-attr')
    expect(hit?.level).toBe('warn')
    expect(hit?.hint).toBeTruthy()
  })

  it('Layer 子元素写 flex-grow 报 warn', async () => {
    const report = await issues(`<fvg width="400" height="200"><p cx="40" cy="40" style="flex-grow:1">甲</p></fvg>`)
    expect(report.issues.some((issue) => issue.code === 'invalid-attr' && issue.level === 'warn' && issue.hint)).toBe(true)
  })

  it('线条写 cx 报 warn', async () => {
    const report = await issues(`<fvg width="400" height="200"><Line cx="10" x1="0" y1="0" x2="40" y2="0" /></fvg>`)
    expect(report.issues.some((issue) => issue.code === 'invalid-attr' && issue.message.includes('线条'))).toBe(true)
  })

  it('Row 报 unknown-tag，并提示改成 div', async () => {
    const report = await issues(`<fvg width="400" height="200"><Row><p>甲</p></Row></fvg>`)
    const hit = report.issues.find((issue) => issue.code === 'unknown-tag')
    expect(hit?.hint).toContain('display:flex')
  })

  it('HTML 上的 width 属性报 warn', async () => {
    const report = await issues(`<fvg width="400" height="200"><p width="80">甲</p></fvg>`)
    const hit = report.issues.find((issue) => issue.code === 'invalid-attr')
    expect(hit?.message).toContain('width')
    expect(hit?.hint).toContain('style')
  })

  it('Layer 写 background 报 warn', async () => {
    const report = await issues(`<fvg width="400" height="200" background="#111"><Layer width="40" height="40" background="#fff" /></fvg>`)
    const hit = report.issues.find((issue) => issue.message.includes('background'))
    expect(hit?.level).toBe('warn')
    expect(hit?.hint).toContain('Rect')
    expect(report.issues.some((issue) => issue.path === 'fvg')).toBe(false)
  })

  it('Layer 写 style 报 warn', async () => {
    const report = await issues(`<fvg width="400" height="200"><Layer cx="20" cy="20" style="background:#fff"></Layer></fvg>`)
    expect(report.issues.some((issue) => issue.code === 'invalid-attr' && issue.message.includes('style'))).toBe(true)
  })

  it('形状写 anchor 报 non-canonical，仍然按 anchor 绘制', async () => {
    const report = await issues(`<fvg width="400" height="200"><Rect cx="10" cy="20" anchor="top-left" width="30" height="40" /></fvg>`)
    expect(report.issues.some((issue) => issue.code === 'non-canonical')).toBe(true)
    const rect = report.elements.find((element) => element.tag === 'Rect')
    expect(rect?.box.left).toBeCloseTo(10, 3)
    expect(rect?.box.top).toBeCloseTo(20, 3)
  })

  it('Rect 的 x、y 按左上角渲染并报 non-canonical', async () => {
    const report = await issues(`<fvg width="400" height="200"><Rect x="15" y="25" width="30" height="40" /></fvg>`)
    const rect = report.elements.find((element) => element.tag === 'Rect')
    expect(rect?.box.left).toBeCloseTo(15, 3)
    expect(rect?.box.top).toBeCloseTo(25, 3)
    expect(report.issues.some((issue) => issue.code === 'non-canonical' && issue.hint)).toBe(true)
  })

  it('不认识的属性不报错', async () => {
    const report = await issues(`<fvg width="200" height="200"><Rect cx="20" cy="20" width="10" height="10" data-total="33" /></fvg>`)
    expect(report.issues).toEqual([])
  })

  it('文字盒子里的块级标签报 invalid-child', async () => {
    const report = await issues(`<fvg width="400" height="200"><div cx="40" cy="40"><h3>标题</h3></div></fvg>`)
    const hit = report.issues.find((issue) => issue.code === 'invalid-child')
    expect(hit?.hint).toContain('display:flex')
  })
})

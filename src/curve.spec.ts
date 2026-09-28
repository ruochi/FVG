import { describe, expect, it } from 'vitest'
import { catmullRomPath } from './curve.js'

describe('catmullRomPath', () => {
  it('两个点退化为直线', () => {
    expect(catmullRomPath([{ x: 10, y: 20 }, { x: 30, y: 40 }], false)).toBe('M 10 20 L 30 40')
  })

  it('曲线穿过给出的点', () => {
    const points = [
      { x: 30, y: 100 },
      { x: 100, y: 40 },
      { x: 170, y: 100 },
    ]
    const d = catmullRomPath(points, false)
    expect(d.startsWith('M 30 100')).toBe(true)
    expect(d).toContain('100 40')
    expect(d.endsWith('170 100')).toBe(true)
    expect(d).not.toContain(' Z')
  })

  it('闭合曲线回到起点', () => {
    const d = catmullRomPath(
      [
        { x: 10, y: 10 },
        { x: 40, y: 10 },
        { x: 20, y: 40 },
      ],
      true,
    )
    expect(d.endsWith(' Z')).toBe(true)
    expect(d).toContain('10 10')
  })
})

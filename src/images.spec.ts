import { describe, expect, it } from 'vitest'
import { objectFitRect } from './images.js'

describe('objectFitRect', () => {
  it('fill 拉伸到盒子', () => {
    expect(objectFitRect('fill', 20, 10, 40, 40)).toEqual({
      sx: 0,
      sy: 0,
      sw: 20,
      sh: 10,
      dx: 0,
      dy: 0,
      dw: 40,
      dh: 40,
    })
  })

  it('cover 居中裁切', () => {
    const fit = objectFitRect('cover', 20, 10, 20, 20)
    expect(fit.dw).toBe(20)
    expect(fit.dh).toBe(20)
    expect(fit.sw).toBe(10)
    expect(fit.sh).toBe(10)
    expect(fit.sx).toBe(5)
    expect(fit.sy).toBe(0)
  })

  it('contain 留边居中', () => {
    const fit = objectFitRect('contain', 20, 10, 20, 20)
    expect(fit.dw).toBe(20)
    expect(fit.dh).toBe(10)
    expect(fit.dx).toBe(0)
    expect(fit.dy).toBe(5)
    expect(fit.sw).toBe(20)
    expect(fit.sh).toBe(10)
  })
})

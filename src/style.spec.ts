import { describe, expect, it } from 'vitest'
import { parseBorder, parseEdges, parseFontWeight, parsePx, parseTransformOrigin, resolveOrigin } from './style.js'

describe('style', () => {
  it('parsePx', () => {
    expect(parsePx('12px')).toBe(12)
    expect(parsePx('12')).toBe(12)
  })

  it('parseEdges', () => {
    expect(parseEdges('10 20 30 40')).toEqual({ top: 10, right: 20, bottom: 30, left: 40 })
  })

  it('parseBorder', () => {
    expect(parseBorder('2px solid #fff')).toEqual({ width: 2, color: '#fff' })
  })

  it('parseFontWeight', () => {
    expect(parseFontWeight('bold')).toBe(700)
  })

  it('transform-origin 关键字和像素', () => {
    expect(parseTransformOrigin('center')).toEqual({ x: 'center', y: 'center' })
    expect(parseTransformOrigin('bottom')).toEqual({ x: 'center', y: 'bottom' })
    expect(parseTransformOrigin('top-left')).toEqual({ x: 'left', y: 'top' })
    expect(parseTransformOrigin('left top')).toEqual({ x: 'left', y: 'top' })
    expect(parseTransformOrigin('40 120')).toEqual({ x: 40, y: 120 })
    expect(parseTransformOrigin('40px 120px')).toEqual({ x: 40, y: 120 })
    expect(parseTransformOrigin('50%')).toBeUndefined()
    expect(parseTransformOrigin('50% 50%')).toBeUndefined()
    expect(parseTransformOrigin('1em 2em')).toBeUndefined()
    expect(parseTransformOrigin('10rem')).toBeUndefined()
    expect(parseTransformOrigin('left 10px')).toBeUndefined()
    expect(resolveOrigin({ x: 'right', y: 'bottom' }, 80, 20)).toEqual({ x: 80, y: 20 })
    expect(resolveOrigin({ x: 8, y: 3 }, 80, 20)).toEqual({ x: 8, y: 3 })
  })
})

import { describe, expect, it } from 'vitest'
import { parseBorder, parseDashArray, parseEdges, parseFontWeight, parseGlow, parsePx, parseShadow } from './style.js'

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

  it('parseShadow', () => {
    expect(parseShadow('0 8px 16px #00000066')).toEqual({ x: 0, y: 8, blur: 16, spread: 0, color: '#00000066' })
    expect(parseShadow('4px 6px')).toEqual({ x: 4, y: 6, blur: 0, spread: 0, color: undefined })
    expect(parseShadow('1 2 3 -4 rgba(0, 0, 0, 0.5)')).toEqual({ x: 1, y: 2, blur: 3, spread: -4, color: 'rgba(0, 0, 0, 0.5)' })
    expect(parseShadow('none')).toBeUndefined()
    expect(parseShadow('8px')).toBeUndefined()
    expect(parseShadow('0 8px -2px')).toBeUndefined()
    expect(parseShadow('#000 0 8px')).toBeUndefined()
  })

  it('parseGlow', () => {
    expect(parseGlow('48px #f6f1e7')).toEqual({ blur: 48, spread: 0, color: '#f6f1e7' })
    expect(parseGlow('12 4')).toEqual({ blur: 12, spread: 4, color: undefined })
    expect(parseGlow('-3px')).toBeUndefined()
    expect(parseGlow('#fff')).toBeUndefined()
  })

  it('parseDashArray', () => {
    expect(parseDashArray('8 4')).toEqual([8, 4])
    expect(parseDashArray('8px, 4px')).toEqual([8, 4])
    expect(parseDashArray('none')).toBeUndefined()
  })
})

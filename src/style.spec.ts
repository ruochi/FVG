import { describe, expect, it } from 'vitest'
import {
  parseBorder,
  parseCorners,
  parseEdges,
  parseFontWeight,
  parseObjectFit,
  parseOverflow,
  parsePaint,
  parsePx,
  parseShadows,
  parseTextStroke,
  parseZIndex,
} from './style.js'

describe('style', () => {
  it('parsePx', () => {
    expect(parsePx('12px')).toBe(12)
    expect(parsePx('12')).toBe(12)
  })

  it('parseEdges', () => {
    expect(parseEdges('10 20 30 40')).toEqual({ top: 10, right: 20, bottom: 30, left: 40 })
  })

  it('parseBorder', () => {
    expect(parseBorder('2px solid #fff')).toEqual({ width: 2, color: '#fff', style: 'solid' })
    expect(parseBorder('2px dashed #fff')).toEqual({ width: 2, color: '#fff', style: 'dashed' })
    expect(parseBorder('3px dotted #000')).toEqual({ width: 3, color: '#000', style: 'dotted' })
  })

  it('描边、阴影、渐变、圆角和层级', () => {
    expect(parseTextStroke('4px #000000')).toEqual({ width: 4, color: '#000000' })
    expect(parseShadows('bad')).toBeNull()
    expect(parseShadows('0px 4px 12px rgba(0,0,0,0.45), 2px 2px 0px #fff')).toEqual([
      { x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.45)' },
      { x: 2, y: 2, blur: 0, color: '#fff' },
    ])
    expect(parsePaint('linear-gradient(90deg, #111, #f7931a)')).toEqual({
      kind: 'linear',
      angle: 90,
      stops: [{ color: '#111' }, { color: '#f7931a' }],
    })
    expect(parsePaint('linear-gradient(to bottom, #111 0px, #fff 40px)')).toMatchObject({ kind: 'linear', angle: 180 })
    expect(parsePaint('radial-gradient(circle, #fff, #000)')).toEqual({
      kind: 'radial',
      stops: [{ color: '#fff' }, { color: '#000' }],
    })
    expect(parsePaint('#fff')).toBe('#fff')
    expect(parsePaint('linear-gradient(nope)')).toBeUndefined()
    expect(parseCorners('8px 24px 0px 16px')).toEqual({ tl: 8, tr: 24, br: 0, bl: 16 })
    expect(parseCorners('12px')).toEqual({ tl: 12, tr: 12, br: 12, bl: 12 })
    expect(parseCorners('8px 16px')).toEqual({ tl: 8, tr: 16, br: 8, bl: 16 })
    expect(parseCorners('1px 2px 3px')).toEqual({ tl: 1, tr: 2, br: 3, bl: 2 })
    expect(parseObjectFit('cover')).toBe('cover')
    expect(parseOverflow('hidden')).toBe('hidden')
    expect(parseZIndex('-2')).toBe(-2)
    expect(parseZIndex('1.5')).toBeUndefined()
  })

  it('parseFontWeight', () => {
    expect(parseFontWeight('bold')).toBe(700)
  })
})

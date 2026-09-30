import { describe, expect, it } from 'vitest'
import {
  colorFilterToCss,
  parseBlend,
  parseBlurRadius,
  parseBorder,
  parseColorFilter,
  parseEdges,
  parseFontWeight,
  parseGlow,
  parseNoise,
  parsePx,
  parseShadow,
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
    expect(parseBorder('2px solid #fff')).toEqual({ width: 2, color: '#fff' })
  })

  it('parseFontWeight', () => {
    expect(parseFontWeight('bold')).toBe(700)
  })

  it('parseBlurRadius / noise / blend / filter', () => {
    expect(parseBlurRadius('12px')).toBe(12)
    expect(parseBlurRadius('-1')).toBeUndefined()
    expect(parseNoise('0.08 #ffffff')).toEqual({ amount: 0.08, color: '#ffffff' })
    expect(parseNoise('2')).toBeUndefined()
    expect(parseBlend('multiply')).toBe('multiply')
    expect(parseBlend('hard-light')).toBeUndefined()
    expect(parseColorFilter('brightness(1.1) hue-rotate(15deg) grayscale(50%)')).toEqual([
      { name: 'brightness', value: 1.1 },
      { name: 'hue-rotate', value: 15 },
      { name: 'grayscale', value: 0.5 },
    ])
    expect(parseColorFilter('blur(4px)')).toBeUndefined()
    expect(colorFilterToCss([{ name: 'hue-rotate', value: 15 }])).toBe('hue-rotate(15deg)')
    expect(parseShadow('0 8 #00000055')).toEqual({ x: 0, y: 8, blur: 0, spread: 0, color: '#00000055' })
    expect(parseGlow('48px #f6f1e7')).toEqual({ blur: 48, spread: 0, color: '#f6f1e7' })
  })
})

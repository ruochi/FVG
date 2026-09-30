import { describe, expect, it } from 'vitest'
import { parseGradient } from './gradient.js'
import { parseGlow, parseShadow } from './style.js'

describe('parseGradient', () => {
  it('线性渐变默认从上到下，补齐色标', () => {
    expect(parseGradient('linear-gradient(#0c1424, #6e7c72)')).toMatchObject({
      kind: 'linear',
      angle: 180,
      stops: [
        { color: '#0c1424', offset: 0 },
        { color: '#6e7c72', offset: 1 },
      ],
    })
  })

  it('径向渐变可以挪圆心', () => {
    expect(parseGradient('radial-gradient(at 40% 35%, #fff, #fff0)')).toMatchObject({
      kind: 'radial',
      at: { x: 0.4, y: 0.35 },
    })
  })
})

describe('shadow and glow', () => {
  it('补上缺省的 blur 和 spread', () => {
    expect(parseShadow('0 8 #00000055')).toEqual({ x: 0, y: 8, blur: 0, spread: 0, color: '#00000055' })
    expect(parseGlow('48px #f6f1e7')).toEqual({ blur: 48, spread: 0, color: '#f6f1e7' })
    expect(parseShadow('big')).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { decodeEntities, parseFlexLayer } from './parse.js'

describe('parseFlexLayer', () => {
  it('保留标签大小写', () => {
    const nodes = parseFlexLayer('<Row><Column /></Row>')
    expect(nodes[0]?.tag).toBe('Row')
    const row = nodes[0]!
    expect((row.children[0] as { tag: string }).tag).toBe('Column')
  })

  it('解析 br 与注释', () => {
    const nodes = parseFlexLayer('<p>a<br/>b<!-- x --></p>')
    const p = nodes[0]!
    expect(p.children.some((c) => typeof c !== 'string' && c.tag === 'br')).toBe(true)
  })

  it('decodeEntities', () => {
    expect(decodeEntities('&times;')).toBe('×')
  })

  it('<draw> 正文按原文保留，含 < 比较符', () => {
    const nodes = parseFlexLayer(`<Layer width="10" height="10">
      <draw>
        if (el.w < 100) ctx.fillRect(0, 0, el.w, el.h)
      </draw>
    </Layer>`)
    const layer = nodes[0]!
    const draw = layer.children.find((c) => typeof c !== 'string' && c.tag === 'draw') as {
      tag: string
      children: string[]
    }
    expect(draw?.tag).toBe('draw')
    expect(draw.children.join('')).toContain('el.w < 100')
    expect(draw.children.join('')).not.toContain('<100')
  })
})

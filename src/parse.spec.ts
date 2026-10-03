import { describe, expect, it } from 'vitest'
import { decodeEntities, parseFvg } from './parse.js'

describe('parseFvg', () => {
  it('不认识的标签保留大小写', () => {
    const nodes = parseFvg('<Row><Column /></Row>')
    expect(nodes[0]?.tag).toBe('Row')
    const row = nodes[0]!
    expect((row.children[0] as { tag: string }).tag).toBe('Column')
  })

  it('已知标签归一成小写，并记下原来的写法', () => {
    const nodes = parseFvg('<Layer><Circle /></Layer>')
    expect(nodes[0]?.tag).toBe('layer')
    expect(nodes[0]?.writtenTag).toBe('Layer')
    const circle = nodes[0]!.children[0] as { tag: string; writtenTag?: string }
    expect(circle.tag).toBe('circle')
    expect(circle.writtenTag).toBe('Circle')
  })

  it('解析 br 与注释', () => {
    const nodes = parseFvg('<p>a<br/>b<!-- x --></p>')
    const p = nodes[0]!
    expect(p.children.some((c) => typeof c !== 'string' && c.tag === 'br')).toBe(true)
  })

  it('decodeEntities', () => {
    expect(decodeEntities('&times;')).toBe('×')
  })

  it('<draw> 正文按原文保留，含 < 比较符', () => {
    const nodes = parseFvg(`<layer width="10" height="10">
      <draw>
        if (el.w < 100) ctx.fillRect(0, 0, el.w, el.h)
      </draw>
    </layer>`)
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

import { describe, expect, it } from 'vitest'
import { decodeEntities, parseFvg } from './parse.js'

describe('parseFvg', () => {
  it('标签统一为小写，闭标签大小写可以不同', () => {
    const nodes = parseFvg('<Row><Column /></row>')
    expect(nodes[0]?.tag).toBe('row')
    const row = nodes[0]!
    expect((row.children[0] as { tag: string }).tag).toBe('column')
  })

  it('解析 br 与注释', () => {
    const nodes = parseFvg('<p>a<br/>b<!-- x --></p>')
    const p = nodes[0]!
    expect(p.children.some((c) => typeof c !== 'string' && c.tag === 'br')).toBe(true)
    expect(p.line).toBe(1)
  })

  it('decodeEntities', () => {
    expect(decodeEntities('&times;')).toBe('×')
  })
})

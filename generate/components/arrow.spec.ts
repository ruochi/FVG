import { describe, expect, it } from 'vitest'
import { serializeFvgDocument, createHostElement } from '../serialize.js'
import { renderVueFvg } from '../vue/renderVueFvg.js'
import { renderReactFvg } from '../react/renderReactFvg.js'
import { arrowElement } from './arrow.js'
import { Arrow as ArrowVue } from './arrowVue.js'
import { Arrow as ArrowReact } from './arrowReact.js'
import React from 'react'

function documentOf(layer: ReturnType<typeof arrowElement>): string {
  const root = createHostElement('fvg')
  root.props.style = 'width:640px; height:360px'
  root.children = [layer]
  return serializeFvgDocument(root)
}

describe('Arrow 组件', () => {
  it('默认箭头长度是线宽的 4 倍，至少 12', () => {
    const source = documentOf(arrowElement({ x1: 280, y1: 200, x2: 420, y2: 200 }))
    expect(source).toContain('<line x1="280" y1="200" x2="420" y2="200" style="stroke: #111111; stroke-width: 4px" />')
    expect(source).toContain('points="420,200 406.14,208 406.14,192"')
    expect(source).toContain('style="fill: #111111"')
    expect(source).not.toContain('<arrow')

    const thin = documentOf(arrowElement({ x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 2 }))
    expect(thin).toContain('points="100,0 89.61,6 89.61,-6"')

    const explicit = documentOf(arrowElement({ x1: 0, y1: 0, x2: 100, y2: 0, head: 10, stroke: '#333' }))
    expect(explicit).toContain('points="100,0 91.34,5 91.34,-5"')
    expect(explicit).toContain('stroke: #333')
  })

  it('坐标无法解析时生成失败', () => {
    expect(() => arrowElement({ x1: 'nope', y1: 0, x2: 1, y2: 1 })).toThrow(/x1/)
  })

  it('Vue 和 React 外壳展开成同一段 fvg', () => {
    const vue = renderVueFvg({
      template: `
        <fvg style="width:640px; height:360px">
          <Arrow :x1="280" :y1="200" :x2="420" :y2="200" stroke="#333" :stroke-width="6" />
        </fvg>
      `,
      components: { Arrow: ArrowVue },
    })
    const react = renderReactFvg(
      React.createElement(
        'fvg',
        { style: 'width:640px; height:360px' },
        React.createElement(ArrowReact, { x1: 280, y1: 200, x2: 420, y2: 200, stroke: '#333', strokeWidth: 6 }),
      ),
    )
    expect(vue).toBe(react)
    expect(vue).toContain('<line x1="280" y1="200" x2="420" y2="200" style="stroke: #333; stroke-width: 6px" />')
    expect(vue).toContain('points="420,200 399.22,212 399.22,188"')
    expect(vue).not.toMatch(/<Arrow|Arrow>/)
  })
})

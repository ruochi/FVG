import { describe, expect, it } from 'vitest'
import { serializeFvgDocument, createHostElement } from '../serialize.js'
import { renderVueFvg } from '../vue/renderVueFvg.js'
import { renderReactFvg } from '../react/renderReactFvg.js'
import { arrowElement } from './arrow.js'
import { Arrow as ArrowVue } from './arrowVue.js'
import { Arrow as ArrowReact } from './arrowReact.js'
import React from 'react'

function documentOf(arrow: ReturnType<typeof arrowElement>): string {
  const root = createHostElement('layer')
  root.props.width = 640
  root.props.height = 360
  root.children = [arrow]
  return serializeFvgDocument(root)
}

describe('Arrow 组件', () => {
  it('默认箭头长度是线宽的 4 倍，至少 12', () => {
    const source = documentOf(arrowElement({ x1: 280, y1: 200, x2: 420, y2: 200 }))
    expect(source).toContain('<arrow x1="280" y1="200" x2="420" y2="200" head="16" stroke="#111111" stroke-width="4" />')
    expect(source).not.toContain('<line')
    expect(source).not.toContain('style=')

    const thin = documentOf(arrowElement({ x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 2 }))
    expect(thin).toContain('head="12"')
    expect(thin).toContain('stroke-width="2"')

    const explicit = documentOf(arrowElement({ x1: 0, y1: 0, x2: 100, y2: 0, head: 10, stroke: '#333' }))
    expect(explicit).toContain('head="10"')
    expect(explicit).toContain('stroke="#333"')
  })

  it('坐标无法解析时生成失败', () => {
    expect(() => arrowElement({ x1: 'nope', y1: 0, x2: 1, y2: 1 })).toThrow(/x1/)
  })

  it('Vue 和 React 外壳展开成同一段 layer', () => {
    const vue = renderVueFvg({
      template: `
        <layer width="640" height="360">
          <Arrow :x1="280" :y1="200" :x2="420" :y2="200" stroke="#333" :stroke-width="6" />
        </layer>
      `,
      components: { Arrow: ArrowVue },
    })
    const react = renderReactFvg(
      React.createElement(
        'layer',
        { width: 640, height: 360 },
        React.createElement(ArrowReact, { x1: 280, y1: 200, x2: 420, y2: 200, stroke: '#333', strokeWidth: 6 }),
      ),
    )
    expect(vue).toBe(react)
    expect(vue).toContain('<arrow x1="280" y1="200" x2="420" y2="200" head="24" stroke="#333" stroke-width="6" />')
    expect(vue).not.toMatch(/<ArrowVue|function Arrow/)
  })
})

import { h, type VNode } from '@vue/runtime-core'
import type { VueFvgComponent } from '../vue/renderVueFvg.js'
import type { FvgHostChild } from '../serialize.js'
import { arrowElement, type ArrowProps } from './arrow.js'

function toVNode(node: FvgHostChild): VNode | string {
  if (node.kind === 'text') return node.text
  return h(
    node.tag,
    node.props,
    node.children.map((child) => toVNode(child)),
  )
}

/** 注册为 `components: { Arrow }`。几何来自 `arrowElement`。 */
export const Arrow: VueFvgComponent = {
  props: ['x1', 'y1', 'x2', 'y2', 'head', 'stroke', 'strokeWidth', 'stroke-width', 'id'],
  setup(props: ArrowProps) {
    return () => toVNode(arrowElement(props))
  },
}

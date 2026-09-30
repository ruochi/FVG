import { h, type VNode } from '@vue/runtime-core'
import type { VueFlexLayerComponent } from '../vue/renderVueFlexLayer.js'
import type { FlexLayerHostChild } from '../serialize.js'
import { arrowElement, type ArrowProps } from './arrow.js'

function toVNode(node: FlexLayerHostChild): VNode | string {
  if (node.kind === 'text') return node.text
  return h(
    node.tag,
    node.props,
    node.children.map((child) => toVNode(child)),
  )
}

/** 注册为 `components: { Arrow }`。几何来自 `arrowElement`。 */
export const Arrow: VueFlexLayerComponent = {
  props: ['x1', 'y1', 'x2', 'y2', 'head', 'stroke', 'strokeWidth', 'stroke-width', 'id'],
  setup(props: ArrowProps) {
    return () => toVNode(arrowElement(props))
  },
}

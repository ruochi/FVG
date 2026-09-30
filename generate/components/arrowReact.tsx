import React, { type ReactElement, type ReactNode } from 'react'
import type { FlexLayerHostChild } from '../serialize.js'
import { arrowElement, type ArrowProps } from './arrow.js'

function toReact(node: FlexLayerHostChild): ReactNode {
  if (node.kind === 'text') return node.text
  return React.createElement(node.tag, node.props, ...node.children.map((child) => toReact(child)))
}

/** JSX 里的 `<Arrow />`。几何来自 `arrowElement`。 */
export function Arrow(props: ArrowProps): ReactElement {
  return toReact(arrowElement(props)) as ReactElement
}

import React, { type ReactElement, type ReactNode } from 'react'
import type { FvgHostChild } from '../serialize.js'
import { arrowElement, type ArrowProps } from './arrow.js'

function toReact(node: FvgHostChild): ReactNode {
  if (node.kind === 'text') return node.text
  return React.createElement(node.tag, node.props, ...node.children.map((child) => toReact(child)))
}

/** JSX 里的 `<Arrow />` 组件，展开成 `<arrow>`。几何来自 `arrowElement`。 */
export function Arrow(props: ArrowProps): ReactElement {
  return toReact(arrowElement(props)) as ReactElement
}

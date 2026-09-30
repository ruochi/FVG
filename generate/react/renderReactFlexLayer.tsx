import React, { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import {
  createHostElement,
  createHostText,
  serializeFlexLayerDocument,
  type FlexLayerHostChild,
  type FlexLayerHostElement,
} from '../serialize.js'

const SKIP = new Set(['key', 'ref', 'children'])

function applyProps(el: FlexLayerHostElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (SKIP.has(key) || key.startsWith('on')) continue
    if (value == null || value === false) continue
    el.props[key] = value
  }
}

function renderChildren(children: ReactNode): FlexLayerHostChild[] {
  if (children == null || children === false) return []
  if (typeof children === 'string' || typeof children === 'number') return [createHostText(String(children))]
  if (Array.isArray(children)) return children.flatMap((child) => renderChildren(child))
  if (!isValidElement(children)) return []
  const node = renderElement(children)
  return [node]
}

function renderElement(el: ReactElement): FlexLayerHostElement {
  const { type, props } = el
  if (type === Fragment) {
    const kids = renderChildren(props.children)
    if (kids.length === 1 && kids[0]!.kind === 'el') return kids[0]!
    throw new Error('Fragment 必须只包一层 Flex Layer 元素，或把子节点直接写在父级里')
  }
  if (typeof type === 'function') {
    const rendered = type(props) as ReactNode
    const kids = renderChildren(rendered)
    if (kids.length === 1 && kids[0]!.kind === 'el') return kids[0]!
    throw new Error(`组件 ${type.name || 'Anonymous'} 必须返回单个 Flex Layer 元素`)
  }
  if (typeof type !== 'string') {
    throw new Error('不支持的 React 元素类型')
  }
  const node = createHostElement(type)
  applyProps(node, props as Record<string, unknown>)
  for (const child of renderChildren(props.children)) node.children.push(child)
  return node
}

/**
 * React JSX → Flex Layer 文本。
 * 小写标签为 Flex Layer 元素；大写函数组件会展开。内部用 React 元素树展开（与 reconciler 宿主输出相同结构）。
 */
export function renderReactFlexLayer(element: ReactElement): string {
  const root = renderElement(element)
  return serializeFlexLayerDocument(root)
}

export { Fragment, isValidElement, type ReactElement, type ReactNode }

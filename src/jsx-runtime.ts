import { h, type FlexLayerProps } from './h.js'
import type { FlexLayerChild, FlexLayerNode } from './parse.js'

function normalizeChildren(children: unknown): FlexLayerChild[] {
  if (children == null || typeof children === 'boolean') return []
  if (Array.isArray(children)) {
    const out: FlexLayerChild[] = []
    for (const c of children) {
      if (c == null || typeof c === 'boolean') continue
      if (typeof c === 'string' || typeof c === 'object') out.push(c as FlexLayerChild)
    }
    return out
  }
  if (typeof children === 'string' || typeof children === 'object') return [children as FlexLayerChild]
  return [String(children)]
}

export function jsx(tag: string, props: FlexLayerProps, _key?: string): FlexLayerNode {
  const { children, ...rest } = props ?? {}
  const extra = normalizeChildren(children)
  return h(tag, rest, ...extra)
}

export function jsxs(tag: string, props: FlexLayerProps, _key?: string): FlexLayerNode {
  return jsx(tag, props)
}

export { h }

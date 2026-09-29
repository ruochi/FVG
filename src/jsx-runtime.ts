import { h, type FvgProps } from './h.js'
import type { FvgChild, FvgNode } from './parse.js'

function normalizeChildren(children: unknown): FvgChild[] {
  if (children == null || typeof children === 'boolean') return []
  if (Array.isArray(children)) {
    const out: FvgChild[] = []
    for (const c of children) {
      if (c == null || typeof c === 'boolean') continue
      if (typeof c === 'string' || typeof c === 'object') out.push(c as FvgChild)
    }
    return out
  }
  if (typeof children === 'string' || typeof children === 'object') return [children as FvgChild]
  return [String(children)]
}

export function jsx(tag: string, props: FvgProps, _key?: string): FvgNode {
  const { children, ...rest } = props ?? {}
  const extra = normalizeChildren(children)
  return h(tag, rest, ...extra)
}

export function jsxs(tag: string, props: FvgProps, _key?: string): FvgNode {
  return jsx(tag, props)
}

export { h }

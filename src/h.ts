import type { DrawFn } from './types.js'
import type { FvgChild, FvgNode } from './parse.js'

export type FvgProps = Record<string, unknown> & {
  draw?: DrawFn
  style?: string
  children?: FvgChild | FvgChild[]
}

function flattenChildren(parts: unknown[]): FvgChild[] {
  const out: FvgChild[] = []
  for (const part of parts) {
    if (Array.isArray(part)) out.push(...flattenChildren(part))
    else if (typeof part === 'string') out.push(part)
    else if (part != null && typeof part === 'object' && 'tag' in part) out.push(part as FvgNode)
  }
  return out
}

/** 构建 FVG 节点；`draw` 挂在节点上，不进 `attrs`。 */
export function h(tag: string, props: FvgProps | null, ...children: unknown[]): FvgNode {
  const attrs: Record<string, string> = {}
  let draw: DrawFn | undefined
  const p = props ?? {}

  for (const [key, value] of Object.entries(p)) {
    if (key === 'draw') {
      draw = value as DrawFn
      continue
    }
    if (key === 'children') continue
    if (value == null) continue
    attrs[key] = String(value)
  }

  const fromProps = p.children
  const merged =
    fromProps == null
      ? flattenChildren(children)
      : flattenChildren(Array.isArray(fromProps) ? fromProps : [fromProps])

  return { tag, attrs, children: merged, draw }
}

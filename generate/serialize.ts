/** 与 @dc/fvg 规范一致：坐标/几何留属性，其余进 style。 */

export const FVG_ATTR_KEYS = [
  'id',
  'family',
  'src',
  'cx',
  'cy',
  'anchor',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'd',
  'closed',
] as const

const ATTR_SET = new Set<string>(FVG_ATTR_KEYS)
const SKIP_PROP = new Set(['key', 'ref', 'ref_for', 'ref_key', 'class', 'children'])

export type FvgHostElement = {
  kind: 'el'
  tag: string
  props: Record<string, unknown>
  children: FvgHostChild[]
}

export type FvgHostText = {
  kind: 'text'
  text: string
}

export type FvgHostChild = FvgHostElement | FvgHostText

function parseStyleText(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl.slice(0, i).trim().toLowerCase()
    const value = decl.slice(i + 1).trim()
    if (key && value) out[key] = value
  }
  return out
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function flattenStyle(value: unknown, out: Record<string, string>): void {
  if (value == null || value === false) return
  if (typeof value === 'string') {
    Object.assign(out, parseStyleText(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStyle(item, out)
    return
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item == null || item === false) continue
      out[kebab(key)] = String(item)
    }
  }
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function formatAttrs(el: FvgHostElement): string {
  const style: Record<string, string> = {}
  const attrs = new Map<string, string>()
  for (const [rawKey, value] of Object.entries(el.props)) {
    if (SKIP_PROP.has(rawKey) || rawKey.startsWith('on') || value == null || value === false) continue
    if (rawKey === 'style') {
      flattenStyle(value, style)
      continue
    }
    const key = kebab(rawKey)
    if (ATTR_SET.has(key)) attrs.set(key, String(value))
    else style[key] = String(value)
  }
  const parts: string[] = []
  for (const key of FVG_ATTR_KEYS) {
    const value = attrs.get(key)
    if (value != null) parts.push(`${key}="${escapeAttr(value)}"`)
  }
  const styleText = Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
  if (styleText) parts.push(`style="${escapeAttr(styleText)}"`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function serializeElement(el: FvgHostElement, indent: number): string {
  const pad = '  '.repeat(indent)
  const tag = el.tag.toLowerCase()
  const attrs = formatAttrs({ ...el, tag })
  const meaningful = el.children.filter((child) => child.kind !== 'text' || child.text.trim() !== '')
  const elements = meaningful.filter((child): child is FvgHostElement => child.kind === 'el')
  if (elements.length === 0) {
    const text = meaningful
      .filter((child): child is FvgHostText => child.kind === 'text')
      .map((child) => child.text)
      .join('')
    if (!text) return `${pad}<${tag}${attrs} />`
    return `${pad}<${tag}${attrs}>${escapeText(text)}</${tag}>`
  }
  const inner = elements.map((child) => serializeElement(child, indent + 1)).join('\n')
  return `${pad}<${tag}${attrs}>\n${inner}\n${pad}</${tag}>`
}

/** 把 `<fvg>` 根序列化为 FVG 文本（末尾换行）。 */
export function serializeFvgDocument(root: FvgHostElement): string {
  if (root.tag.toLowerCase() !== 'fvg') {
    throw new Error('根节点必须是 <fvg>')
  }
  return `${serializeElement(root, 0)}\n`
}

export function createHostElement(tag: string): FvgHostElement {
  return { kind: 'el', tag: tag.toLowerCase(), props: {}, children: [] }
}

export function createHostText(text: string): FvgHostText {
  return { kind: 'text', text }
}

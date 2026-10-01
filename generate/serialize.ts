/** HTML 用 style，Layer 和图形用属性。标签大小写原样保留。 */

const HTML_TAGS = new Set(['div', 'h1', 'h2', 'h3', 'p', 'span', 'strong', 'b', 'em', 'br', 'img', 'image'])
/** 图片仍是 HTML，但 src / alt 不是 CSS，留在属性上。 */
const IMAGE_ATTRS = new Set(['src', 'alt'])

const ATTR_ORDER = [
  'id',
  'family',
  'src',
  'href',
  'width',
  'height',
  'background',
  'color',
  'font-family',
  'safe',
  'cx',
  'cy',
  'anchor',
  'anchor-box',
  'x1',
  'y1',
  'x2',
  'y2',
  'r',
  'rx',
  'ry',
  'points',
  'd',
  'closed',
  'head',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'rotate',
  'scale',
  'origin',
  'shadow',
  'glow',
  'inner-shadow',
  'inner-glow',
  'blur',
  'backdrop-blur',
  'noise',
  'overlay',
  'grade',
  'grade-mask',
  'glass',
  'filter',
  'blend',
  'border',
  'border-radius',
  'overflow',
]

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

function isHtmlTag(tag: string): boolean {
  return HTML_TAGS.has(tag.toLowerCase())
}

function isImageTag(tag: string): boolean {
  const name = tag.toLowerCase()
  return name === 'img' || name === 'image'
}

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
  const html = isHtmlTag(el.tag)
  const style: Record<string, string> = {}
  const attrs = new Map<string, string>()
  const putAttr = (key: string, value: string) => {
    attrs.set(key, value)
  }
  for (const [rawKey, value] of Object.entries(el.props)) {
    if (SKIP_PROP.has(rawKey) || rawKey.startsWith('on') || value == null || value === false) continue
    if (rawKey === 'style') {
      if (html) flattenStyle(value, style)
      else {
        const flat: Record<string, string> = {}
        flattenStyle(value, flat)
        for (const [key, item] of Object.entries(flat)) putAttr(key, item)
      }
      continue
    }
    const key = kebab(rawKey)
    if (html && key !== 'id' && !(isImageTag(el.tag) && IMAGE_ATTRS.has(key))) style[key] = String(value)
    else putAttr(key, String(value))
  }
  const parts: string[] = []
  const seen = new Set<string>()
  for (const key of ATTR_ORDER) {
    const value = attrs.get(key)
    if (value == null) continue
    seen.add(key)
    parts.push(`${key}="${escapeAttr(value)}"`)
  }
  for (const key of [...attrs.keys()].filter((item) => !seen.has(item)).sort()) {
    parts.push(`${key}="${escapeAttr(attrs.get(key)!)}"`)
  }
  const styleText = Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
  if (styleText) parts.push(`style="${escapeAttr(styleText)}"`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function serializeElement(el: FvgHostElement, indent: number): string {
  const pad = '  '.repeat(indent)
  const tag = el.tag
  const attrs = formatAttrs(el)
  // <draw> 正文是 JS，必须原样写出（含 <），不能做 HTML 转义
  if (tag === 'draw') {
    const body = el.children
      .map((child) => (child.kind === 'text' ? child.text : ''))
      .join('')
    if (!body.trim()) return `${pad}<draw${attrs} />`
    const indented = body
      .replace(/^\n/, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => (line.trim() ? `${pad}  ${line.replace(/^\s+/, '')}` : ''))
      .join('\n')
    return `${pad}<draw${attrs}>\n${indented}\n${pad}</draw>`
  }
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

/** 把 `<Layer>` 根序列化为 Flex Layer 文本（末尾换行）。 */
export function serializeFvgDocument(root: FvgHostElement): string {
  const tag = root.tag.toLowerCase() === 'fvg' ? 'Layer' : root.tag
  if (tag !== 'Layer') {
    throw new Error('根节点必须是 <Layer>')
  }
  return `${serializeElement({ ...root, tag: 'Layer' }, 0)}\n`
}

export function createHostElement(tag: string): FvgHostElement {
  return { kind: 'el', tag, props: {}, children: [] }
}

export function createHostText(text: string): FvgHostText {
  return { kind: 'text', text }
}

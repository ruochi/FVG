export type FvgNode = {
  tag: string
  attrs: Record<string, string>
  children: FvgChild[]
  /** 开标签在源码中的行号（1-based） */
  line?: number
}

export type FvgChild = string | FvgNode

const VOID_TAGS = new Set(['br', 'font'])

const CLOSE_TAG_RE = /<\s*\/\s*([a-zA-Z][\w-]*)\s*>/y
const OPEN_TAG_RE = /<\s*([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/)?\s*>/y
const ATTR_RE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  times: '\u00D7',
  divide: '\u00F7',
  middot: '\u00B7',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  deg: '\u00B0',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

function parseAttrs(text: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(text)) !== null) {
    attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

/** 去掉注释和 XML 声明，但保留换行，避免行号错位 */
function stripCommentsPreserveLines(source: string): string {
  let out = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  out = out.replace(/<\?xml[\s\S]*?\?>/g, (m) => m.replace(/[^\n]/g, ' '))
  return out
}

function lineAt(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++
  }
  return line
}

/** 解析 FVG 标记。标签名统一为小写（`<Column>` 与 `<column>` 相同）。 */
export function parseFvg(source: string): FvgNode[] {
  const src = stripCommentsPreserveLines(source)
  const root: FvgNode = { tag: '#root', attrs: {}, children: [] }
  const stack: FvgNode[] = [root]
  let pos = 0

  const pushText = (text: string) => {
    if (text) stack[stack.length - 1].children.push(decodeEntities(text))
  }

  while (pos < src.length) {
    const lt = src.indexOf('<', pos)
    if (lt === -1) {
      pushText(src.slice(pos))
      break
    }
    pushText(src.slice(pos, lt))

    CLOSE_TAG_RE.lastIndex = lt
    const close = CLOSE_TAG_RE.exec(src)
    if (close) {
      const tag = close[1].toLowerCase()
      const idx = findOpen(stack, tag)
      if (idx > 0) stack.length = idx
      pos = lt + close[0].length
      continue
    }

    OPEN_TAG_RE.lastIndex = lt
    const open = OPEN_TAG_RE.exec(src)
    if (!open) {
      pushText('<')
      pos = lt + 1
      continue
    }
    const tag = open[1].toLowerCase()
    const node: FvgNode = {
      tag,
      attrs: parseAttrs(open[2] ?? ''),
      children: [],
      line: lineAt(src, lt),
    }
    stack[stack.length - 1].children.push(node)
    if (!open[3] && !VOID_TAGS.has(tag)) stack.push(node)
    pos = lt + open[0].length
  }

  return root.children.filter((c): c is FvgNode => typeof c !== 'string')
}

function findOpen(stack: FvgNode[], tag: string): number {
  for (let i = stack.length - 1; i > 0; i--) {
    if (stack[i].tag === tag) return i
  }
  return -1
}

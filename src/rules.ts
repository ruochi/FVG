import type { FvgNode } from './parse.js'
import { parseStyle } from './style.js'
import { isTextBoxTag } from './text.js'
import type { Issue, IssueLevel } from './types.js'
import { isLineTag, isShapeTag } from './tags.js'

const BLOCK_IN_TEXT = new Set(['h1', 'h2', 'h3', 'p', 'div'])

/** 这些属性在 HTML 上应写进 style。 */
const HTML_STYLE_ATTRS = [
  'width',
  'height',
  'opacity',
  'rotate',
  'scale',
  'origin',
  'background',
  'padding',
  'font-size',
  'color',
  'flex',
  'flex-grow',
  'flex-shrink',
  'gap',
  'border',
  'border-radius',
  'max-width',
  'align-items',
  'justify-content',
  'shadow',
  'glow',
  'inner-shadow',
  'inner-glow',
  'blur',
  'backdrop-blur',
  'noise',
  'glass',
  'filter',
  'blend',
  'writing-mode',
]

function flagged(level: IssueLevel, code: string, path: string, message: string, hint: string): Issue {
  return { level, code, path, message, hint }
}

function present(attrs: Record<string, string>, key: string): boolean {
  return attrs[key] != null && attrs[key] !== ''
}

export function hasTwoPoint(attrs: Record<string, string>): boolean {
  return ['x1', 'y1', 'x2', 'y2'].every((key) => present(attrs, key))
}

export function isDisplayFlex(style: string | undefined): boolean {
  const display = parseStyle(style).display?.trim().toLowerCase()
  return display === 'flex' || display === 'inline-flex'
}

function styleHasFlex(style: string | undefined): boolean {
  if (!style) return false
  return /(?:^|;)\s*(?:flex-grow|flex-shrink|flex)\s*:/.test(style)
}

function hasStyle(attrs: Record<string, string>): boolean {
  return present(attrs, 'style') && attrs.style.trim() !== ''
}

function usesAttributes(node: FvgNode): boolean {
  return (
    node.tag === 'Layer' ||
    node.tag === 'symbol' ||
    node.tag === 'use' ||
    isShapeTag(node.tag) ||
    isLineTag(node.tag) ||
    Boolean(node.draw)
  )
}

/** 只检查归属表里的已知属性。不认识的属性留给 draw 使用，不报错。 */
export function checkChildAttrs(node: FvgNode, parent: 'layer' | 'flex', path: string): Issue[] {
  const out: Issue[] = []
  const attrs = node.attrs
  const positioned = present(attrs, 'cx') || present(attrs, 'cy') || present(attrs, 'anchor')
  const html = isTextBoxTag(node.tag)

  if (html) {
    if (positioned) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'cx、cy、anchor 只写在 Layer 上',
          '外包一层 Layer，例如 <Layer cx="120" cy="64" anchor="top-left"><div style="display:flex">…</div></Layer>',
        ),
      )
    }
    const misplaced = HTML_STYLE_ATTRS.filter((key) => present(attrs, key))
    if (misplaced.length > 0) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          `${misplaced.join('、')} 应写在 style 里`,
          'HTML 只用 style，例如 <p style="opacity:0.5; font-size:40px">',
        ),
      )
    }
  }

  if (parent === 'flex' && !html && positioned) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        'cx、cy、anchor 只写在 Layer 上',
        '定位写在外层 Layer 上，flex 子元素跟着排布走',
      ),
    )
  }

  if (parent === 'flex' && isShapeTag(node.tag)) {
    const circlePoints = node.tag === 'Circle' && (present(attrs, 'x1') || present(attrs, 'y1'))
    if (hasTwoPoint(attrs) || circlePoints) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          '形状的坐标只能写在 Layer 里',
          '包一层 <Layer width height>，或改用 <div style="width:…; height:…; background:…">',
        ),
      )
    } else if (!positioned) {
      out.push(
        flagged(
          'info',
          'non-canonical',
          path,
          '形状放在 flex 里不是规范写法',
          '包一层 <Layer width height>，或改用 div 盒子',
        ),
      )
    }
  }

  if (parent === 'layer') {
    if (styleHasFlex(attrs.style)) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'flex、flex-grow、flex-shrink 只在 display:flex 的子元素上有效',
          '把该元素放进 <div style="display:flex">',
        ),
      )
    }
    if (isLineTag(node.tag) && positioned) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          '线条用自身坐标定位，cx、cy、anchor 无效',
          '删掉 cx、cy、anchor，直接写 x1、y1 或 points',
        ),
      )
    }
    if ((isShapeTag(node.tag) || node.draw) && present(attrs, 'anchor')) {
      out.push(
        flagged(
          'info',
          'non-canonical',
          path,
          '形状不用 anchor',
          '用 cx、cy 表示中心，或改用 x1、y1、x2、y2',
        ),
      )
    }
    if (node.tag === 'Rect' && (present(attrs, 'x') || present(attrs, 'y')) && !hasTwoPoint(attrs)) {
      out.push(
        flagged(
          'info',
          'non-canonical',
          path,
          'Rect 的 x、y 按左上角理解',
          '改成 cx、cy，或 x1、y1、x2、y2',
        ),
      )
    }
    if ((node.tag === 'Rect' || node.tag === 'Ellipse') && hasTwoPoint(attrs)) {
      const mixed =
        present(attrs, 'width') ||
        present(attrs, 'height') ||
        present(attrs, 'cx') ||
        present(attrs, 'cy') ||
        present(attrs, 'rx') ||
        present(attrs, 'ry')
      if (mixed) {
        out.push(
          flagged(
            'warn',
            'invalid-attr',
            path,
            '两点写法和尺寸写法只能选一种，已按两点绘制',
            '只保留 x1、y1、x2、y2，或只保留 cx、cy 和尺寸',
          ),
        )
      }
    }
    if (node.tag === 'Circle' && (present(attrs, 'x1') || present(attrs, 'y1') || present(attrs, 'x2') || present(attrs, 'y2'))) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'Circle 只支持 cx、cy、r',
          '删掉 x1、y1、x2、y2',
        ),
      )
    }
  }

  if ((node.tag === 'Layer' || node.tag === 'use') && present(attrs, 'background')) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        'Layer 不使用 background',
        '色块用 <Rect fill="...">、HTML 的 style="background:..."，或 <draw> 自己画。画布底色只写在根 <Layer background>',
      ),
    )
  }

  if (usesAttributes(node) && hasStyle(attrs)) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        'Layer 和图形不使用 style',
        '把 width、opacity 写成属性。色块用 Rect / HTML / <draw>',
      ),
    )
  }

  return out
}

export function checkTextBoxChildren(node: FvgNode, path: string): Issue[] {
  const out: Issue[] = []
  for (const child of node.children) {
    if (typeof child === 'string') continue
    const tag = child.tag.toLowerCase()
    if (!BLOCK_IN_TEXT.has(tag)) continue
    out.push(
      flagged(
        'warn',
        'invalid-child',
        path,
        `文字盒子里不能放 <${tag}>`,
        '改成 <div style="display:flex; flex-direction:column">',
      ),
    )
  }
  return out
}

export function rowColumnHint(tag: string): string {
  return tag === 'Column'
    ? '<div style="display:flex; flex-direction:column">'
    : '<div style="display:flex">'
}

import type { FvgNode } from './parse.js'
import type { Issue, IssueLevel } from './types.js'
import { isFlexTag, isLineTag, isShapeTag } from './tags.js'

const BLOCK_IN_TEXT = new Set(['h1', 'h2', 'h3', 'p', 'div'])

function flagged(level: IssueLevel, code: string, path: string, message: string, hint: string): Issue {
  return { level, code, path, message, hint }
}

function present(attrs: Record<string, string>, key: string): boolean {
  return attrs[key] != null && attrs[key] !== ''
}

export function hasTwoPoint(attrs: Record<string, string>): boolean {
  return ['x1', 'y1', 'x2', 'y2'].every((key) => present(attrs, key))
}

function styleHasFlex(style: string | undefined): boolean {
  if (!style) return false
  return /(?:^|;)\s*(?:flex-grow|flex-shrink|flex)\s*:/.test(style)
}

/** 只检查归属表里的已知属性。不认识的属性留给 draw 使用，不报错。 */
export function checkChildAttrs(node: FvgNode, parent: 'layer' | 'flex', path: string): Issue[] {
  const out: Issue[] = []
  const attrs = node.attrs
  const positioned = present(attrs, 'cx') || present(attrs, 'cy') || present(attrs, 'anchor')

  if (parent === 'flex') {
    if (positioned) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'cx、cy、anchor 只在 Layer 里有效',
          '把定位写在外层 Layer 上，例如 <Layer cx="120" cy="64" anchor="top-left"><Row>…</Row></Layer>',
        ),
      )
    }
    if (isShapeTag(node.tag)) {
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
            '形状放在 Row/Column 里不是规范写法',
            '包一层 <Layer width height>，或改用 div 盒子',
          ),
        )
      }
    }
  }

  if (parent === 'layer') {
    if (styleHasFlex(attrs.style)) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'flex、flex-grow、flex-shrink 只在 Row/Column 的子元素上有效',
          '把该元素放进 Row 或 Column',
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
    if (isFlexTag(node.tag) && positioned) {
      out.push(
        flagged(
          'info',
          'non-canonical',
          path,
          'Row/Column 的规范定位是包一层 Layer',
          '<Layer cx="…" cy="…" anchor="…"><Row>…</Row></Layer>',
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
      const mixed = present(attrs, 'width') || present(attrs, 'height') || present(attrs, 'cx') || present(attrs, 'cy') || present(attrs, 'rx') || present(attrs, 'ry')
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
        '改用 Column 把多段文字排开',
      ),
    )
  }
  return out
}

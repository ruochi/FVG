import type { FvgNode } from './parse.js'
import { parseStyle } from './style.js'
import { isTextBoxTag } from './text.js'
import type { Issue, IssueLevel } from './types.js'
import { isImageTag, isLineTag, isShapeTag } from './tags.js'

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
  'ink-stroke',
  'blur',
  'backdrop-blur',
  'noise',
  'glass',
  'filter',
  'blend',
  'writing-mode',
  'object-fit',
  'object-position',
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

/** 文字和图片都按 HTML：视觉属性进 style，不写 cx。 */
export function isHtmlTag(tag: string): boolean {
  return isTextBoxTag(tag) || isImageTag(tag)
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
  const html = isHtmlTag(node.tag)

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

  // overlay 仅 Layer；use / 图形 / HTML 误写都警告
  if (node.tag !== 'Layer' && present(attrs, 'overlay')) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        'overlay 只写在 Layer 上',
        '外包一层 Layer，例如 <Layer overlay="#00000066"><Rect …/></Layer>',
      ),
    )
  }
  if (html) {
    const styleMap = parseStyle(attrs.style)
    const webkitStroke = styleMap['-webkit-text-stroke']
    const outline = styleMap.outline ?? (present(attrs, 'outline') ? attrs.outline : undefined)
    const wantsBrowserStroke =
      (webkitStroke != null && webkitStroke.trim() !== '' && webkitStroke.trim().toLowerCase() !== 'none') ||
      (outline != null && outline.trim() !== '' && outline.trim().toLowerCase() !== 'none' && outline.trim() !== '0')
    if (wantsBrowserStroke) {
      out.push(
        flagged(
          'info',
          'non-canonical',
          path,
          'outline 与 -webkit-text-stroke 不会按墨迹描边',
          '改用 ink-stroke，例如 style="ink-stroke:6 #000 outside"',
        ),
      )
    }
    if (styleMap.overlay) {
      out.push(
        flagged(
          'warn',
          'invalid-attr',
          path,
          'overlay 只写在 Layer 上',
          '不要写在 HTML style 里；外包 <Layer overlay="…">',
        ),
      )
    }
  }

  const gradeKeys = ['grade', 'grade-mask'].filter((key) => present(attrs, key))
  if (node.tag !== 'Layer' && gradeKeys.length > 0) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        `${gradeKeys.join('、')} 只写在 Layer 上`,
        '外包一层 Layer，例如 <Layer grade="lomo"><img src="…" style="width:320px" /></Layer>',
      ),
    )
  }
  const gradeInStyle = Object.keys(parseStyle(attrs.style)).filter((key) => key === 'grade' || key === 'grade-mask')
  if (gradeInStyle.length > 0) {
    out.push(
      flagged(
        'warn',
        'invalid-attr',
        path,
        `${gradeInStyle.join('、')} 只写在 Layer 的属性上`,
        '不要写进 style；外包 <Layer grade="…">',
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
    if (isImageTag(tag)) {
      out.push(
        flagged(
          'warn',
          'invalid-child',
          path,
          '文字盒子里不能放图片',
          '改成 <div style="display:flex">，把 <img src="…"> 放进去',
        ),
      )
      continue
    }
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

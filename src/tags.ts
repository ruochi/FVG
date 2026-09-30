/** 文档根与定位容器都是 Layer；仍接受旧根标签 fvg / FVG。 */
export const ROOT_TAGS = new Set(['Layer', 'fvg', 'FVG'])
export const SHAPE_TAGS = new Set(['Rect', 'Circle', 'Ellipse'])
export const LINE_TAGS = new Set(['Line', 'Arrow', 'Polyline', 'Polygon', 'Path', 'Curve'])
export const FONT_TAG = 'font'

/** HTML 图片。`image` 与 `img` 是同一个标签。 */
const IMAGE_TAGS = new Set(['img', 'image'])

export function isImageTag(tag: string): boolean {
  return IMAGE_TAGS.has(tag.toLowerCase())
}

export function isRootTag(tag: string): boolean {
  return ROOT_TAGS.has(tag)
}

export function isLineTag(tag: string): boolean {
  return LINE_TAGS.has(tag)
}

export function isShapeTag(tag: string): boolean {
  return SHAPE_TAGS.has(tag)
}

/** 旧根标签 fvg 归一成 Layer */
export function normalizeRootTag(tag: string): string {
  return tag.toLowerCase() === 'fvg' ? 'Layer' : tag
}

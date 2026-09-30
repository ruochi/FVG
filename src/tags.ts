/** 文档根与定位容器都是 Layer。 */
export const ROOT_TAGS = new Set(['Layer'])
export const SHAPE_TAGS = new Set(['Rect', 'Circle', 'Ellipse'])
export const LINE_TAGS = new Set(['Line', 'Arrow', 'Polyline', 'Polygon', 'Path', 'Curve'])
export const FONT_TAG = 'font'

export function isRootTag(tag: string): boolean {
  return ROOT_TAGS.has(tag)
}

export function isLineTag(tag: string): boolean {
  return LINE_TAGS.has(tag)
}

export function isShapeTag(tag: string): boolean {
  return SHAPE_TAGS.has(tag)
}

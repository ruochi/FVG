export const SHAPE_TAGS = new Set(['Rect', 'Circle', 'Ellipse'])
export const LINE_TAGS = new Set(['Line', 'Arrow', 'Polyline', 'Polygon', 'Path', 'Curve'])
export const FONT_TAG = 'font'

/** HTML 图片。`image` 与 `img` 是同一个标签。 */
const IMAGE_TAGS = new Set(['img', 'image'])

export function isImageTag(tag: string): boolean {
  return IMAGE_TAGS.has(tag.toLowerCase())
}

export function isLineTag(tag: string): boolean {
  return LINE_TAGS.has(tag)
}

export function isShapeTag(tag: string): boolean {
  return SHAPE_TAGS.has(tag)
}

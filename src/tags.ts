export const ROOT_TAGS = new Set(['fvg', 'FVG', 'Layer'])
export const FLEX_TAGS = new Set(['Row', 'Column'])
export const SHAPE_TAGS = new Set(['Rect', 'Circle', 'Ellipse'])
export const LINE_TAGS = new Set(['Line', 'Arrow', 'Polyline', 'Polygon', 'Path'])
export const IMAGE_TAGS = new Set(['Image'])
export const FONT_TAG = 'font'

export function isLineTag(tag: string): boolean {
  return LINE_TAGS.has(tag)
}

export function isShapeTag(tag: string): boolean {
  return SHAPE_TAGS.has(tag)
}

export function isFlexTag(tag: string): boolean {
  return FLEX_TAGS.has(tag)
}

export function isImageTag(tag: string): boolean {
  return IMAGE_TAGS.has(tag)
}

export const ROOT_TAGS = new Set(['fvg', 'layer'])
export const FLEX_TAGS = new Set(['row', 'column'])
export const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse'])
export const LINE_TAGS = new Set(['line', 'arrow', 'polyline', 'polygon', 'path'])
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

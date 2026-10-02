/**
 * 属性注册表。归属检查、序列化顺序和文档里的归属表都从这里来。
 * 不认识的属性不在表里，留给 draw，不报错。
 */

export type DocGroup = 'layer' | 'html' | 'graphic' | 'image' | 'effect' | 'layer-only'

export type AttrDef = {
  name: string
  /** 写在 HTML 标签的属性位（而不是 style）时报 invalid-attr */
  warnOnHtmlAttr?: boolean
  /** 只允许写在 Layer 的属性上；写在别的标签上报 invalid-attr */
  layerOnlyAttr?: boolean
  /** 写进任何标签的 style 都报 invalid-attr（grade / grade-mask） */
  forbidInStyle?: boolean
  /** 只在 HTML 的 style 里出现时才报（overlay） */
  forbidInHtmlStyle?: boolean
  docGroup?: DocGroup
  /** 速查里的一行示例，只有效果属性 */
  cheat?: string
  /** 图库覆盖率要检查的效果名 */
  effect?: boolean
}

/** 和 serialize 的属性顺序一致，改顺序会改变生成的 .layer。 */
export const ATTR_ORDER = [
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
] as const

export const ATTRS: AttrDef[] = [
  { name: 'width', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'height', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'opacity', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'rotate', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'scale', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'origin', warnOnHtmlAttr: true, docGroup: 'layer' },
  { name: 'background', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'padding', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'font-size', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'color', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'flex', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'flex-grow', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'flex-shrink', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'gap', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'border', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'border-radius', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'max-width', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'align-items', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'justify-content', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'writing-mode', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'object-fit', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'object-position', warnOnHtmlAttr: true, docGroup: 'html' },
  { name: 'cx', docGroup: 'layer' },
  { name: 'cy', docGroup: 'layer' },
  { name: 'anchor', docGroup: 'layer' },
  { name: 'x1', docGroup: 'graphic' },
  { name: 'y1', docGroup: 'graphic' },
  { name: 'x2', docGroup: 'graphic' },
  { name: 'y2', docGroup: 'graphic' },
  { name: 'points', docGroup: 'graphic' },
  { name: 'd', docGroup: 'graphic' },
  { name: 'fill', docGroup: 'graphic' },
  { name: 'stroke', docGroup: 'graphic' },
  { name: 'src', docGroup: 'image' },
  { name: 'alt', docGroup: 'image' },
  { name: 'shadow', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`0 8 16 #00000055`' },
  { name: 'glow', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`56 #f3ead4`' },
  { name: 'inner-shadow', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '同 shadow' },
  { name: 'inner-glow', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '同 glow' },
  { name: 'blur', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '单个像素' },
  { name: 'backdrop-blur', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '单个像素' },
  { name: 'glass', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`clear` 或 `clear, blur 8, tint #fff2`' },
  { name: 'noise', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`0.08`' },
  { name: 'filter', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`saturate(1.1)`' },
  { name: 'blend', warnOnHtmlAttr: true, docGroup: 'effect', effect: true, cheat: '`multiply`' },
  {
    name: 'overlay',
    layerOnlyAttr: true,
    forbidInHtmlStyle: true,
    docGroup: 'layer-only',
    effect: true,
    cheat: '`#00000066` 或 `linear-gradient(...) soft-light`',
  },
  {
    name: 'grade',
    layerOnlyAttr: true,
    forbidInStyle: true,
    docGroup: 'layer-only',
    effect: true,
    cheat: '`lomo 0.8, fade 0.1`',
  },
  {
    name: 'grade-mask',
    layerOnlyAttr: true,
    forbidInStyle: true,
    docGroup: 'layer-only',
    effect: true,
    cheat: '同 fill，alpha 是强度',
  },
]

/** 这些属性在 HTML 上应写进 style。顺序与历史检查一致。 */
export const HTML_STYLE_ATTRS: string[] = ATTRS.filter((attr) => attr.warnOnHtmlAttr).map((attr) => attr.name)

export const LAYER_ONLY_ATTRS: string[] = ATTRS.filter((attr) => attr.layerOnlyAttr).map((attr) => attr.name)

export const EFFECT_ATTRS: string[] = ATTRS.filter((attr) => attr.effect).map((attr) => attr.name)

const DOC_GROUP_ORDER: DocGroup[] = ['layer', 'html', 'graphic', 'image', 'effect', 'layer-only']

const DOC_GROUP_LABEL: Record<DocGroup, string> = {
  layer: '`Layer` 的属性。HTML 上写了报 `warn`',
  html: 'HTML 的 `style`。`Layer` 或图形写了 `style` 报 `warn`',
  graphic: '图形属性，坐标是所在 `Layer` 的局部坐标',
  image: '只写在 `img` 上。宽高仍放进 `style`',
  effect: '图形和 `Layer` 写属性；文字写在 `style`。见第 9 章',
  'layer-only': '只写在 `Layer` 上。写在别处或写进 `style` 报 `warn`',
}

function namesIn(group: DocGroup): string {
  return ATTRS.filter((attr) => attr.docGroup === group)
    .map((attr) => `\`${attr.name}\``)
    .join('、')
}

/** SPEC 归属总表（不含表头）。 */
export function ownershipTableBody(): string {
  const rows = DOC_GROUP_ORDER.map(
    (group) => `| ${namesIn(group)} | ${DOC_GROUP_LABEL[group]} |`,
  )
  return ['| 属性 | 写在哪 |', '| --- | --- |', ...rows].join('\n')
}

/** CHEATSHEET 里的效果一行。 */
export function effectCheatLine(): string {
  const parts = ATTRS.filter((attr) => attr.cheat).map((attr) => `\`${attr.name}\` ${attr.cheat}`)
  return `效果：${parts.join('、')}。作用于整棵子树的 \`overlay\`、\`grade\`、\`grade-mask\` 只写在 \`Layer\` 上。`
}

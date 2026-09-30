/**
 * FVG 效果属性一览（生成层共用）。
 * 视觉总览：examples/effects-gallery.fvg → effects-gallery.png
 * 规范：SPEC.md §7 · 手册：docs/EFFECTS.md
 *
 * Layer / 图形 / 线条 → 标签属性
 * 文字 / flex HTML → style（如 style="shadow:0 8 12 #00000066"）
 */

export const FVG_EFFECT_ATTRS = [
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
] as const

export type FvgEffectAttr = (typeof FVG_EFFECT_ATTRS)[number]

/** React / 文档用：效果属性 → 字符串或数字（blur 半径） */
export type FvgEffectsProps = {
  shadow?: string
  glow?: string
  'inner-shadow'?: string
  'inner-glow'?: string
  blur?: number | string
  'backdrop-blur'?: number | string
  noise?: string
  glass?: string
  filter?: string
  blend?: string
}

/** 语法速记，给 AI / 模板抄 */
export const FVG_EFFECT_EXAMPLES: Record<FvgEffectAttr, string> = {
  shadow: '0 12 20 #00000088',
  glow: '36 #f4efe4',
  'inner-shadow': '0 10 16 #00000099',
  'inner-glow': '28 #7ec8ff',
  blur: '6',
  'backdrop-blur': '16',
  noise: '0.35 #ffffff',
  glass: 'clear',
  filter: 'grayscale(1)',
  blend: 'multiply',
}

import type { ReactNode } from 'react'

/** HTML 用 style；Layer 和图形用属性。 */
type FvgStyle = string | Record<string, string | number | undefined>

type FvgCommon = {
  id?: string
  style?: FvgStyle
  children?: ReactNode
}

type FvgPositioned = FvgCommon & {
  cx?: number | string
  cy?: number | string
  anchor?: string
}

type FvgEffects = {
  // jsx-effects:begin
  /** 0 8 16 #00000055 */
  shadow?: string
  /** 56 #f3ead4 */
  glow?: string
  /** 0 8 16 #00000055 */
  'inner-shadow'?: string
  /** 28 #7ec8ff */
  'inner-glow'?: string
  /** 6 */
  blur?: number | string
  /** 16 */
  'backdrop-blur'?: number | string
  /** clear */
  glass?: string
  /** 0.08 */
  noise?: string
  /** saturate(1.1) */
  filter?: string
  /** multiply */
  blend?: string
// jsx-effects:end
}

/** 仅 Layer：纯色/渐变叠加 */
type FvgLayerOverlay = {
  // jsx-overlay:begin
  /** #00000066 */
  overlay?: string
// jsx-overlay:end
}

/** 仅 Layer：调色 */
type FvgLayerGrade = {
  // jsx-grade:begin
  /** lomo 0.8, fade 0.1 */
  grade?: string
  /** radial-gradient(#fff0 30%, #fff) */
  'grade-mask'?: string
// jsx-grade:end
}

type FvgShape = FvgPositioned &
  FvgEffects & {
    r?: number | string
    rx?: number | string
    ry?: number | string
    width?: number | string
    height?: number | string
    fill?: string
    stroke?: string
    strokeWidth?: number | string
    'stroke-width'?: number | string
    opacity?: number | string
  }

declare global {
  namespace JSX {
    interface IntrinsicElements {
      font: { family?: string; src?: string }
      /**
       * 根画布与定位容器。
       * `background` 只在根上当画布底色；嵌套 Layer 不填背景，色块用 Rect / HTML / draw。
       */
      Layer: FvgPositioned &
        FvgEffects &
        FvgLayerOverlay &
        FvgLayerGrade & {
          width?: number | string
          height?: number | string
          /** 仅根节点：画布底色。嵌套 Layer 写了会 warn 并忽略 */
          background?: string
          color?: string
          'font-family'?: string
          safe?: number | string
          opacity?: number | string
          rotate?: number | string
          scale?: number | string
          origin?: string
          overflow?: string
          border?: string
          'border-radius'?: string | number
        }
      /** 子标签：正文 JS，可用 ctx、el；不参与布局 */
      draw: FvgCommon
      symbol: FvgCommon & { width?: number | string; height?: number | string }
      use: FvgPositioned & {
        href?: string
        rotate?: number | string
        scale?: number | string
        /** 忽略；色块用 Rect / HTML / draw */
        background?: string
      }
      Rect: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Circle: FvgShape
      Ellipse: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Line: FvgCommon & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string; stroke?: string; strokeWidth?: number | string }
      Arrow: FvgCommon & {
        x1?: number | string
        y1?: number | string
        x2?: number | string
        y2?: number | string
        head?: number | string
        stroke?: string
        strokeWidth?: number | string
      }
      Polyline: FvgCommon & { points?: string }
      Polygon: FvgCommon & { points?: string; fill?: string }
      Path: FvgCommon & { d?: string; fill?: string }
      Curve: FvgCommon & { points?: string; closed?: boolean | string; fill?: string; stroke?: string }
      h1: FvgCommon
      h2: FvgCommon
      h3: FvgCommon
      p: FvgCommon
      div: FvgCommon
      span: FvgCommon
      strong: FvgCommon
      b: FvgCommon
      em: FvgCommon
      br: FvgCommon
      /** HTML 图片。src、alt 是属性，宽高写 style。`image` 与 `img` 相同。 */
      img: FvgCommon & { src?: string; alt?: string }
      image: FvgCommon & { src?: string; alt?: string }
    }
  }
}

export {}

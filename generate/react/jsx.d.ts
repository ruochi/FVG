import type { ReactNode } from 'react'

/** HTML 用 style；layer 和图形用属性。 */
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

/** 仅 layer：纯色/渐变叠加 */
type FvgLayerOverlay = {
  overlay?: string
}

/** 仅 layer：调色。例如 grade="lomo 0.8, fade 0.1"，grade-mask 的 alpha 是强度 */
type FvgLayerGrade = {
  grade?: string
  'grade-mask'?: string
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
       * `background` 只在根上当画布底色；嵌套 layer 不填背景，色块用 rect / HTML / draw。
       */
      layer: FvgPositioned &
        FvgEffects &
        FvgLayerOverlay &
        FvgLayerGrade & {
          width?: number | string
          height?: number | string
          /** 仅根节点：画布底色。嵌套 layer 写了会 warn 并忽略 */
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
      /**
       * 蒙版。只作为 layer 的直接子元素。
       * 里面写 rect / circle / ellipse / polygon / path / img；省略 fill 为 #fff，只取 alpha。
       */
      mask: FvgCommon
      use: FvgPositioned & {
        href?: string
        rotate?: number | string
        scale?: number | string
        /** 忽略；色块用 rect / HTML / draw */
        background?: string
      }
      rect: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      circle: FvgShape
      ellipse: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      line: FvgCommon & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string; stroke?: string; strokeWidth?: number | string }
      arrow: FvgCommon & {
        x1?: number | string
        y1?: number | string
        x2?: number | string
        y2?: number | string
        head?: number | string
        stroke?: string
        strokeWidth?: number | string
      }
      polyline: FvgCommon & { points?: string }
      polygon: FvgCommon & { points?: string; fill?: string }
      path: FvgCommon & { d?: string; fill?: string }
      curve: FvgCommon & { points?: string; closed?: boolean | string; fill?: string; stroke?: string }
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

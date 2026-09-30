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

/** 仅 Layer：纯色/渐变叠加 */
type FvgLayerOverlay = {
  overlay?: string
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
        FvgLayerOverlay & {
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
    }
  }
}

export {}

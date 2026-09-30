import type { ReactNode } from 'react'

/** HTML 用 style；Layer 和图形用属性。 */
type FlexLayerStyle = string | Record<string, string | number | undefined>

type FlexLayerCommon = {
  id?: string
  style?: FlexLayerStyle
  children?: ReactNode
}

type FlexLayerPositioned = FlexLayerCommon & {
  cx?: number | string
  cy?: number | string
  anchor?: string
}

type FlexLayerEffects = {
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

type FlexLayerShape = FlexLayerPositioned &
  FlexLayerEffects & {
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
      Layer: FlexLayerPositioned &
        FlexLayerEffects & {
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
      draw: FlexLayerCommon
      symbol: FlexLayerCommon & { width?: number | string; height?: number | string }
      use: FlexLayerPositioned & {
        href?: string
        rotate?: number | string
        scale?: number | string
        /** 忽略；色块用 Rect / HTML / draw */
        background?: string
      }
      Rect: FlexLayerShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Circle: FlexLayerShape
      Ellipse: FlexLayerShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Line: FlexLayerCommon & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string; stroke?: string; strokeWidth?: number | string }
      Arrow: FlexLayerCommon & {
        x1?: number | string
        y1?: number | string
        x2?: number | string
        y2?: number | string
        head?: number | string
        stroke?: string
        strokeWidth?: number | string
      }
      Polyline: FlexLayerCommon & { points?: string }
      Polygon: FlexLayerCommon & { points?: string; fill?: string }
      Path: FlexLayerCommon & { d?: string; fill?: string }
      Curve: FlexLayerCommon & { points?: string; closed?: boolean | string; fill?: string; stroke?: string }
      h1: FlexLayerCommon
      h2: FlexLayerCommon
      h3: FlexLayerCommon
      p: FlexLayerCommon
      div: FlexLayerCommon
      span: FlexLayerCommon
      strong: FlexLayerCommon
      b: FlexLayerCommon
      em: FlexLayerCommon
      br: FlexLayerCommon
    }
  }
}

export {}

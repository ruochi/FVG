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
  filter?: string
  blend?: string
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
      fvg: FvgCommon & {
        width?: number | string
        height?: number | string
        background?: string
        color?: string
        safe?: number | string
      }
      font: { family?: string; src?: string }
      Layer: FvgPositioned &
        FvgEffects & {
          width?: number | string
          height?: number | string
          background?: string
          opacity?: number | string
          rotate?: number | string
          scale?: number | string
          origin?: string
          overflow?: string
        }
      symbol: FvgCommon & { width?: number | string; height?: number | string }
      use: FvgPositioned & { href?: string; rotate?: number | string; scale?: number | string }
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

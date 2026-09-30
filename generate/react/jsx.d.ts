import type { ReactNode } from 'react'
import type { FvgEffectsProps } from '../effects.js'

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

/** 效果属性，见 generate/effects.ts / docs/EFFECTS.md / examples/effects-gallery.png */
type FvgEffects = FvgEffectsProps

type FvgPaint = {
  fill?: string
  stroke?: string
  strokeWidth?: number | string
  'stroke-width'?: number | string
  'stroke-dasharray'?: string
  'stroke-linecap'?: string
  'stroke-linejoin'?: string
  opacity?: number | string
  border?: string
}

type FvgShape = FvgPositioned &
  FvgEffects &
  FvgPaint & {
    r?: number | string
    rx?: number | string
    ry?: number | string
    width?: number | string
    height?: number | string
  }

type FvgStrokeShape = FvgCommon &
  FvgEffects &
  FvgPaint & {
    x1?: number | string
    y1?: number | string
    x2?: number | string
    y2?: number | string
    points?: string
    d?: string
    closed?: boolean | string
    head?: number | string
  }

declare global {
  namespace JSX {
    interface IntrinsicElements {
      fvg: FvgCommon & {
        width?: number | string
        height?: number | string
        background?: string
        color?: string
        'font-family'?: string
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
          border?: string
          'border-radius'?: string | number
        }
      symbol: FvgCommon & { width?: number | string; height?: number | string }
      use: FvgPositioned & { href?: string; rotate?: number | string; scale?: number | string }
      Rect: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Circle: FvgShape
      Ellipse: FvgShape & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      Line: FvgStrokeShape
      Arrow: FvgStrokeShape
      Polyline: FvgStrokeShape
      Polygon: FvgStrokeShape
      Path: FvgStrokeShape
      Curve: FvgStrokeShape
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

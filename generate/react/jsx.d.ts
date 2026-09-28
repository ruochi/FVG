import type { ReactNode } from 'react'

/** FVG 小写标签；PascalCase 留给用户组件。 */
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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      fvg: FvgCommon & { style?: FvgStyle }
      font: { family?: string; src?: string }
      layer: FvgPositioned
      row: FvgPositioned
      column: FvgPositioned
      rect: FvgPositioned & { rx?: string; ry?: string }
      circle: FvgPositioned & { r?: string; fill?: string }
      ellipse: FvgPositioned & { rx?: string; ry?: string }
      line: FvgCommon & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }
      arrow: FvgCommon & {
        x1?: number | string
        y1?: number | string
        x2?: number | string
        y2?: number | string
        head?: string
      }
      polyline: FvgCommon & { points?: string }
      polygon: FvgCommon & { points?: string }
      path: FvgCommon & { d?: string }
      h1: FvgPositioned
      h2: FvgPositioned
      h3: FvgPositioned
      p: FvgPositioned
      div: FvgPositioned
      span: FvgPositioned
      strong: FvgCommon
      b: FvgCommon
      em: FvgCommon
      br: FvgCommon
    }
  }
}

export {}

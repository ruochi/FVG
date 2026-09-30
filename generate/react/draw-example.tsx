import React from 'react'
import { renderReactFlexLayer } from './renderReactFlexLayer.js'
import { Layer, Rect } from './tags.js'

/**
 * AI 参考：嵌套 Layer 不填背景，用 <draw> 自己画。
 * 根上的 background 仍是画布底色。
 */
export function DrawPanelReact() {
  return (
    <Layer width="320" height="200" background="#0f1115" color="#f4f1ea">
      <Rect cx="80" cy="100" width="100" height="80" rx="12" fill="#1c2430" />
      <Layer width="100" height="80" cx="220" cy="100">
        <draw>
          {`ctx.fillStyle = '#3ecfc4'
if (el.w < 200) ctx.fillRect(0, 0, el.w, el.h)`}
        </draw>
      </Layer>
    </Layer>
  )
}

export function renderDrawPanelReact(): string {
  return renderReactFlexLayer(<DrawPanelReact />)
}

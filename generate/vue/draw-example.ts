/**
 * AI 参考：嵌套 layer 不填背景，用 <draw> 自己画。
 * 根上的 background 仍是画布底色。
 */
import { renderVueFvg } from './renderVueFvg.js'

export function renderDrawPanelVue(): string {
  return renderVueFvg({
    template: `
<layer width="320" height="200" background="#0f1115" color="#f4f1ea">
  <rect cx="80" cy="100" width="100" height="80" rx="12" fill="#1c2430" />
  <layer width="100" height="80" cx="220" cy="100">
    <draw>ctx.fillStyle = '#3ecfc4'; if (el.w < 200) ctx.fillRect(0, 0, el.w, el.h)</draw>
  </layer>
</layer>
    `,
  })
}

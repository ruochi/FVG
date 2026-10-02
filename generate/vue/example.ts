/**
 * AI 参考模板：Vue 生成 Flex Layer
 *
 * - 根必须是 <layer width height background>（background 仅根上画布底色）
 * - 嵌套 layer 不填背景；色块用 rect / HTML style / <draw>
 * - 标签一律小写。layer 和图形只用属性；文字和 div 只用 style
 * - 排布用 <div style="display:flex">，不要 row / column
 * - PascalCase 组件名在 components 里注册，展开后不留组件名
 * - 自定义绘制见 generate/vue/draw-example.ts
 */
import { renderVueFvg } from './renderVueFvg.js'

export const starsExampleBindings = {
  title: '霜降',
  stars: [
    { name: 'a', y: 48, r: 2 },
    { name: 'b', y: 90, r: 4 },
  ],
}

export function renderStarsPosterVue(): string {
  return renderVueFvg({
    template: `
<layer width="320" height="200" background="#1a1220">
  <circle
    v-for="(s, i) in stars"
    :key="s.name"
    :cx="i * 80 + 40"
    :cy="s.y"
    :r="s.r"
    fill="#fff8e7"
  />
  <Caption :text="title" />
</layer>
    `,
    bindings: starsExampleBindings,
    components: {
      Caption: {
        props: ['text'],
        template: `
          <layer>
            <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
              <h1 style="font-size:32px">{{ $props.text }}</h1>
            </div>
          </layer>
        `,
      },
    },
  })
}

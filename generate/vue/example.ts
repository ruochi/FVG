/**
 * AI 参考模板：Vue 生成 FVG
 *
 * - 根必须是 <fvg>
 * - FVG 标签全小写：circle、column、layer、row …
 * - cx、cy、anchor、x1、y1 … 写在属性上；fill、r、gap 等写在 style 或 :style
 * - PascalCase 标签名在 components 里注册，会展开成 FVG 标签
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
<fvg style="width:320px; height:200px; background:#1a1220">
  <circle
    v-for="(s, i) in stars"
    :key="s.name"
    :cx="i * 80 + 40"
    :cy="s.y"
    :r="s.r + 'px'"
    fill="#fff8e7"
  />
  <Caption :text="title" />
</fvg>
    `,
    bindings: starsExampleBindings,
    components: {
      Caption: {
        props: ['text'],
        template: `
          <column style="gap:8px; align-items:start">
            <h1 style="font-size:32px">{{ $props.text }}</h1>
          </column>
        `,
      },
    },
  })
}

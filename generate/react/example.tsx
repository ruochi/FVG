import React from 'react'
import { renderReactFvg } from './renderReactFvg.js'
import { Circle, Layer } from './tags.js'

/**
 * AI 参考模板：React JSX 生成 Flex Layer
 *
 * - 根必须是 <Layer width height background>（background 仅根上画布底色）
 * - 嵌套 Layer 不填背景；色块用 Rect / HTML style / <draw>
 * - Layer、Circle 从 tags.ts 引入（值是标签名字符串），属性不放进 style
 * - 排布用 <div style="display:flex">
 * - 大写开头的函数组件会展开成 Flex Layer 标签
 * - 自定义绘制见 generate/react/draw-example.tsx
 */
export const starsExample = {
  title: '霜降',
  stars: [
    { name: 'a', y: 48, r: 2 },
    { name: 'b', y: 90, r: 4 },
  ],
}

function Caption({ text }: { text: string }) {
  return (
    <Layer>
      <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
        <h1 style="font-size:32px">{text}</h1>
      </div>
    </Layer>
  )
}

export function StarsPosterReact(props: typeof starsExample) {
  return (
    <Layer width="320" height="200" background="#1a1220">
      {props.stars.map((s, i) => (
        <Circle key={s.name} cx={i * 80 + 40} cy={s.y} r={s.r} fill="#fff8e7" />
      ))}
      <Caption text={props.title} />
    </Layer>
  )
}

export function renderStarsPosterReact(): string {
  return renderReactFvg(<StarsPosterReact {...starsExample} />)
}

import React from 'react'
import { renderReactFvg } from './renderReactFvg.js'

/**
 * AI 参考模板：React JSX 生成 Flex Layer
 *
 * - 根必须是 <layer width height background>（background 仅根上画布底色）
 * - 嵌套 layer 不填背景；色块用 rect / HTML style / <draw>
 * - 标签一律小写，直接写 <layer> <circle>，不用 import
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
    <layer>
      <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
        <h1 style="font-size:32px">{text}</h1>
      </div>
    </layer>
  )
}

export function StarsPosterReact(props: typeof starsExample) {
  return (
    <layer width="320" height="200" background="#1a1220">
      {props.stars.map((s, i) => (
        <circle key={s.name} cx={i * 80 + 40} cy={s.y} r={s.r} fill="#fff8e7" />
      ))}
      <Caption text={props.title} />
    </layer>
  )
}

export function renderStarsPosterReact(): string {
  return renderReactFvg(<StarsPosterReact {...starsExample} />)
}

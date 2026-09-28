import React from 'react'
import { renderReactFvg } from './renderReactFvg.js'

/**
 * AI 参考模板：React JSX 生成 FVG
 *
 * - 根必须是 <fvg>
 * - FVG 标签全小写，不用 import
 * - cx、cy、x1、y1 … 作为 JSX 属性；fill、r、gap 放进 style={{ ... }}
 * - 大写开头的函数组件会展开成 FVG 标签
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
    <column style="gap:8px; align-items:start">
      <h1 style="font-size:32px">{text}</h1>
    </column>
  )
}

export function StarsPosterReact(props: typeof starsExample) {
  return (
    <fvg style="width:320px; height:200px; background:#1a1220">
      {props.stars.map((s, i) => (
        <circle
          key={s.name}
          cx={i * 80 + 40}
          cy={s.y}
          r={`${s.r}px`}
          fill="#fff8e7"
        />
      ))}
      <Caption text={props.title} />
    </fvg>
  )
}

export function renderStarsPosterReact(): string {
  return renderReactFvg(<StarsPosterReact {...starsExample} />)
}

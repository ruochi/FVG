# 用 Vue 或 React 生成 FVG

FVG 的**生成**和**画图**是两层：

```text
Vue 模板 / React JSX  →  .fvg 文本  →  renderFvg / fvg render  →  PNG
```

生成层只产出 `.fvg` 字符串，不调用 canvas。规范见 [SPEC.md](SPEC.md)（标签全小写）。完整生成 / 验证 / AI 工作流见 [AI.md](../AI.md)。

## 规则（AI 必守）

| 写什么 | 放哪里 |
| --- | --- |
| `cx`、`cy`、`anchor`、`x1`、`y1`、`x2`、`y2`、`points`、`d`、`id` | 标签**属性** |
| `fill`、`r`、`width`、`gap`、`font-size`、`shadow`、`glow` 等 | **`style`** |
| 容器 / 形状 / 线条 / 文字 | 标签**全小写**：`fvg`、`layer`、`column`、`circle`、`h1` … |
| 可复用块 | **PascalCase 组件名**（Vue `components` / React 函数组件），展开后只剩 FVG 标签 |

根节点必须是 **`<fvg>`**，并在 `style` 里写画布 `width`、`height`（及 `background` 等）。

生成完成后交给现有渲染器：

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { renderFvg } from '@dc/fvg' // 仓库根目录 src/render.js

const source = '...' // 下面 Vue 或 React 的输出
writeFileSync('out.fvg', source)
const { png } = await renderFvg(source, { baseDir: process.cwd() })
```

或 CLI：`npx tsx src/cli.ts render out.fvg -o out.png`

---

## Vue

**目录：** [`generate/vue/`](vue/)

**依赖（见 [`generate/vue/package.json`](vue/package.json)）：**

- `@vue/compiler-dom` — 编译模板（`v-for`、`v-if`、`{{ }}`、`:cx`）
- `@vue/runtime-core` — 自定义渲染器，挂内存节点后序列化成 FVG

**入口：**

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'
// 或参考模板：
import { renderStarsPosterVue } from './generate/vue/example.js'
```

**AI 模板（抄 [`generate/vue/example.ts`](vue/example.ts)）：**

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'

const source = renderVueFvg({
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
  bindings: {
    title: '霜降',
    stars: [{ name: 'a', y: 48, r: 2 }, { name: 'b', y: 90, r: 4 }],
  },
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
```

要点：

- 小写标签 = FVG 元素，不用注册。
- `Caption` 这种大写名在 `components` 里注册。
- 动态坐标用 `:cx="表达式"`；像素半径可写 `:r="s.r + 'px'"` 或放进 `:style`。

---

## React

**目录：** [`generate/react/`](react/)

**依赖（见 [`generate/react/package.json`](react/package.json)）：**

- `react`
- `@types/react`（TypeScript）

**类型：** [`generate/react/jsx.d.ts`](react/jsx.d.ts) 声明小写 FVG 标签，避免 TS 当成 HTML。

**入口：**

```ts
import { renderReactFvg } from './generate/react/renderReactFvg.js'
import { renderStarsPosterReact } from './generate/react/example.js'
```

**AI 模板（抄 [`generate/react/example.tsx`](react/example.tsx)）：**

```tsx
import React from 'react'
import { renderReactFvg } from './generate/react/renderReactFvg.js'

function Caption({ text }: { text: string }) {
  return (
    <column style="gap:8px; align-items:start">
      <h1 style="font-size:32px">{text}</h1>
    </column>
  )
}

const stars = [
  { name: 'a', y: 48, r: 2 },
  { name: 'b', y: 90, r: 4 },
]

const source = renderReactFvg(
  <fvg style="width:320px; height:200px; background:#1a1220">
    {stars.map((s, i) => (
      <circle key={s.name} cx={i * 80 + 40} cy={s.y} r={`${s.r}px`} fill="#fff8e7" />
    ))}
    <Caption text="霜降" />
  </fvg>,
)
```

要点：

- 小写 JSX 标签 = FVG，无需 import。
- 循环用 `array.map`；条件用 `{show && <circle ... />}`。
- `Caption` 等大写函数组件会展开；组件应返回**单个** FVG 元素（通常是 `column` / `layer` / 一段 `h1` 外包）。

实现说明：当前用 **React 元素树递归展开**（依赖 `react`）。若要用 `react-reconciler` 挂完整宿主，输出格式与这里相同，但 React 19 需实现较长宿主配置表。

---

## 测试

在仓库根目录安装生成层依赖并跑测试：

```bash
cd generate && npm install && npm test
```

测试会用 [`src/layout.ts`](../src/layout.ts) 校验生成的 `.fvg` 能否正常布局。

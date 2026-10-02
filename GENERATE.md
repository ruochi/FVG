# 用 Vue 或 React 生成 Flex Layer

Flex Layer 的**生成**和**画图**是两层。可复用块的写法见 [generate/COMPONENTS.md](generate/COMPONENTS.md)。

```text
Vue 模板 / React JSX  →  .layer 文本  →  renderLayer / flexlayer render  →  PNG
```

生成层只产出 `.layer` 字符串，不调用 canvas。标签和属性以 [SPEC.md](SPEC.md) 为准，必须遵守的写法见 [AGENTS.md](AGENTS.md)。

生成层特有的两件事：

- Vue 模板会压空白。`<draw>` 里多句 JS 写在一行，用 `;` 分隔。
- React 把大写 JSX 当成变量。`Layer`、`Circle` 从 [`generate/react/tags.ts`](generate/react/tags.ts) 引入；`div`、`h1`、`draw` 小写，不用 import。

生成完成后交给渲染器：

```ts
import { writeFileSync } from 'node:fs'
import { renderLayer } from '@dc/flexlayer'

const source = '...' // 下面 Vue 或 React 的输出
writeFileSync('out.layer', source)
const { png } = await renderLayer(source, { baseDir: process.cwd() })
```

或 CLI：`npx tsx src/cli.ts render out.layer -o out.png`

---

## Vue

**目录：** [`generate/vue/`](generate/vue/)

**依赖（见 [`generate/vue/package.json`](generate/vue/package.json)）：**

- `@vue/compiler-dom` — 编译模板（`v-for`、`v-if`、`{{ }}`、`:cx`）
- `@vue/runtime-core` — 自定义渲染器，挂内存节点后序列化成 Flex Layer

**入口：**

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'
import { renderStarsPosterVue } from './generate/vue/example.js'
```

**AI 模板（抄 [`generate/vue/example.ts`](generate/vue/example.ts)）：**

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'

const source = renderVueFvg({
  template: `
<Layer width="320" height="200" background="#1a1220">
  <Circle
    v-for="(s, i) in stars"
    :key="s.name"
    :cx="i * 80 + 40"
    :cy="s.y"
    :r="s.r"
    fill="#fff8e7"
  />
  <Caption :text="title" />
</Layer>
  `,
  bindings: {
    title: '霜降',
    stars: [{ name: 'a', y: 48, r: 2 }, { name: 'b', y: 90, r: 4 }],
  },
  components: {
    Caption: {
      props: ['text'],
      template: `
        <Layer>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
            <h1 style="font-size:32px">{{ $props.text }}</h1>
          </div>
        </Layer>
      `,
    },
  },
})
```

要点：

- 未注册的标签按模板里的大小写输出。`Circle`、`Layer` 不用注册。
- `Caption` 这种组件名在 `components` 里注册，展开后文件里不留这个名字。
- 动态坐标用 `:cx="表达式"`。半径写 `:r="s.r"`，不要放进 `style`。
- 自定义绘制抄 [`generate/vue/draw-example.ts`](generate/vue/draw-example.ts)：嵌套 Layer 里放 `<draw>`，不要给嵌套 Layer 写 `background`。Vue 模板会压空白，多句 JS 请写在一行并用 `;` 分隔。

---

## React

**目录：** [`generate/react/`](generate/react/)

**依赖（见 [`generate/react/package.json`](generate/react/package.json)）：**

- `react`
- `@types/react`（TypeScript）

**类型：** [`generate/react/jsx.d.ts`](generate/react/jsx.d.ts) 声明 Flex Layer 标签。

**入口：**

```ts
import { renderReactFvg } from './generate/react/renderReactFvg.js'
import { renderStarsPosterReact } from './generate/react/example.js'
```

**AI 模板（抄 [`generate/react/example.tsx`](generate/react/example.tsx)）：**

```tsx
import React from 'react'
import { renderReactFvg } from './generate/react/renderReactFvg.js'
import { Circle, Layer } from './generate/react/tags.js'

function Caption({ text }: { text: string }) {
  return (
    <Layer>
      <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
        <h1 style="font-size:32px">{text}</h1>
      </div>
    </Layer>
  )
}

const stars = [
  { name: 'a', y: 48, r: 2 },
  { name: 'b', y: 90, r: 4 },
]

const source = renderReactFvg(
  <Layer width="320" height="200" background="#1a1220">
    {stars.map((s, i) => (
      <Circle key={s.name} cx={i * 80 + 40} cy={s.y} r={s.r} fill="#fff8e7" />
    ))}
    <Caption text="霜降" />
  </Layer>,
)
```

要点：

- `div`、`h1`、`draw` 小写，不用 import。根与定位都用 `Layer`；`Layer`、`Circle` 从 [`generate/react/tags.ts`](generate/react/tags.ts) 引入：React 会把大写 JSX 当成变量，这些常量的值就是标签名。
- 循环用 `array.map`；条件用 `{show && <Circle ... />}`。
- 大写函数组件会展开，并且必须返回**单个** Flex Layer 元素。
- 自定义绘制抄 [`generate/react/draw-example.tsx`](generate/react/draw-example.tsx)：`<draw>{code}</draw>`，正文里的 `<` 会原样写进 `.layer`。

实现说明：当前用 **React 元素树递归展开**（依赖 `react`）。若要用 `react-reconciler` 挂完整宿主，输出格式与这里相同。

---

## 测试

在仓库根目录：

```bash
cd generate && npm install
cd .. && npm run test:generate
```

测试会用 [`src/layout.ts`](src/layout.ts) 校验生成的 `.layer` 能否布局，并确认没有 `row`、`column` 和小写图形标签。

### 完整海报示例（Vue）

[`generate/vue/poster-city-jazz.ts`](generate/vue/poster-city-jazz.ts)：`v-for` 星点、日程组件、标签组件，生成 1080×1620 海报。十张互不相似的海报在 [`generate/vue/posters-batch.ts`](generate/vue/posters-batch.ts)。

```bash
npx tsx generate/vue/build-poster-city-jazz.mts
npx tsx src/cli.ts render examples/poster-city-jazz.layer -o poster-city-jazz.png --scale 0.5
```

# FVG 组件规范

组件属于**生成层**。渲染器不执行组件，只画展开后的 `.fvg`。标签规则以 [SPEC.md](../SPEC.md) 为准，生成流程见 [GENERATE.md](../GENERATE.md)。

```text
组件（PascalCase，且不是 Layer / Circle 这类基本标签） → 展开成 FVG 标签 → .fvg → PNG
```

## 1. 什么是组件

组件是一段可复用的生成代码，用来补上默认值，或把反复出现的几行标签收成一个名字。

- 基本标签里，`Layer`、`Rect`、`Circle`、`Line`、`Arrow` 等图形首字母大写；`fvg`、`div`、`h1` 小写。组件名不要和这些基本标签撞车。
- 展开之后的 `.fvg` 里不留下组件名。`Arrow` 组件展开成渲染器的 `<Arrow>` 标签，这是基本标签，不是组件残留。
- 一张海报只用一种生成器。用 Vue 就注册 Vue 外壳，用 React 就调用 React 外壳。
- 默认值只写一次。Vue / React 外壳只负责把参数交进去。

渲染器遇到不认识的标签会记 `unknown-tag`。组件必须在生成时展开完。

## 2. 文件

每个初级组件一组文件，放在 [`generate/components/`](components/)：

| 文件 | 职责 |
| --- | --- |
| `<name>.ts` | `xxxElement(props)`，返回一棵 `FvgHostElement`。默认值在这里 |
| `<name>Vue.ts` | 名为组件的 Vue 选项，注册到 `renderVueFvg` 的 `components` |
| `<name>React.tsx` | 同名函数组件，放进 `renderReactFvg` 的 JSX |

`xxxElement` 是规范实现。两层外壳调用它，不再单独算默认值。

## 3. 参数和展开结果

- 组件返回**一个**元素。有多段内容时，包在 `Layer` 里，里面用 `div` 的 `display:flex` 排布。
- `Layer` 和图形的值展开后仍是标签属性，不进 `style`。
- 文字的字号、颜色写在 `style` 里。
- 每个组件在本文写清：参数、默认值、展开成哪个标签。
- 坐标或长度无法解析时，生成直接失败，不写出半截 `.fvg`。
- 长度可以是数字或 `12px`。

别人要加组件时，按第 2 节加一组文件，并在下面补一节参数表。初级库只收需要默认值、或每张海报都会重写的块。`Rect`、`Circle`、`Curve`、`p` 不再包一层。

## 4. Arrow

从 `(x1, y1)` 画到 `(x2, y2)`。展开成渲染器自己的 `<Arrow>`，不再手画折线。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `x1`、`y1`、`x2`、`y2` | 必填 | 线段两端，Layer 局部坐标 |
| `stroke` | `#111111` | 线色 |
| `strokeWidth` | `4` | 线宽，单位像素。也可以写成 `stroke-width` |
| `head` | `max(12, strokeWidth × 4)` | 箭头长度。写了就用这个值 |
| `id` | 无 | 写在 `<Arrow>` 上 |

展开形状：

```html
<Arrow x1="280" y1="200" x2="420" y2="200" head="24" stroke="#333" stroke-width="6" />
```

Vue：

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'
import { Arrow as ArrowVue } from './generate/components/arrowVue.js'

const source = renderVueFvg({
  template: `
    <fvg width="640" height="360">
      <Arrow :x1="280" :y1="200" :x2="420" :y2="200" stroke="#333" :stroke-width="6" />
    </fvg>
  `,
  components: { Arrow: ArrowVue },
})
```

React：

```tsx
import { renderReactFvg } from './generate/react/renderReactFvg.js'
import { Arrow } from './generate/components/arrowReact.js'

const source = renderReactFvg(
  <fvg width="640" height="360">
    <Arrow x1={280} y1={200} x2={420} y2={200} stroke="#333" strokeWidth={6} />
  </fvg>,
)
```

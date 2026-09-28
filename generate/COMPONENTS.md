# FVG 组件规范

组件属于**生成层**。渲染器不执行组件，只画展开后的 `.fvg`。标签和 `style` 的规则仍以 [SPEC.md](../SPEC.md) 为准，生成流程见 [GENERATE.md](GENERATE.md)。

```text
组件（PascalCase） → 展开成小写基本元素 → .fvg → PNG
```

## 1. 什么是组件

组件是一段可复用的生成代码，用来算出基本元素不好手写的几何，或把反复出现的几行标签收成一个名字。

- 组件名是 **PascalCase**，例如 `Arrow`。基本元素全是小写，两者不会撞名。
- 展开之后的 `.fvg` 里只有小写标签。文件里不留下组件名。
- 一张海报只用一种生成器。用 Vue 就注册 Vue 外壳，用 React 就调用 React 外壳。
- 几何和默认值只写一次。Vue / React 外壳只负责把参数交进去，并把节点交回各自的生成器。

渲染器遇到不认识的标签会记 `unknown-tag`。组件必须在生成时展开完。

## 2. 文件

每个初级组件一组文件，放在 [`generate/components/`](components/)：

| 文件 | 职责 |
| --- | --- |
| `<name>.ts` | `xxxElement(props)`，返回一棵 `FvgHostElement`。默认值、坐标换算都在这里 |
| `<name>Vue.ts` | 名为组件的 Vue 选项，注册到 `renderVueFvg` 的 `components` |
| `<name>React.tsx` | 同名函数组件，放进 `renderReactFvg` 的 JSX |

`xxxElement` 是规范实现。两层外壳调用它，不再单独算点。

## 3. 参数和展开结果

- 组件返回**一个**元素。有多段内容时，包在 `layer`、`row` 或 `column` 里。
- 落在 layer 坐标上的值，展开后仍是标签属性：`x1`、`y1`、`x2`、`y2`、`points`、`cx`、`cy`、`d`、`id`。
- 颜色、线宽、字号等进 `style`。
- 每个组件在本文写清：参数、默认值、展开成哪些标签。
- 坐标或长度无法解析时，生成直接失败，不写出半截 `.fvg`。
- 长度可以是数字或 `12px`。

别人要加组件时，按第 2 节加一组文件，并在下面补一节参数表。初级库只收需要计算、或每张海报都会重写的块。`rect`、`circle`、`curve`、`p` 不再包一层。

## 4. Arrow

从 `(x1, y1)` 画到 `(x2, y2)`，末端有一个等腰三角箭头。展开后不使用渲染器里的 `<arrow>` 标签。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `x1`、`y1`、`x2`、`y2` | 必填 | 线段两端，layer 坐标 |
| `stroke` | `#111111` | 线色，同时作为箭头填充 |
| `strokeWidth` | `4` | 线宽，单位像素。也可以写成 `stroke-width` |
| `head` | `max(12, strokeWidth × 4)` | 箭头两边的长度。写了就用这个值，不再套最小值 |
| `id` | 无 | 写在外包的 `layer` 上 |

展开形状：

```html
<layer>
  <line x1="280" y1="200" x2="420" y2="200" style="stroke: #333; stroke-width: 6px" />
  <polygon points="420,200 …" style="fill: #333" />
</layer>
```

箭头在终点。两条边相对线段反方向各偏 30°，边长是 `head`。这和渲染器绘制 `<arrow>` 时的张角一致。

Vue：

```ts
import { renderVueFvg } from './generate/vue/renderVueFvg.js'
import { Arrow as ArrowVue } from './generate/components/arrowVue.js'

const source = renderVueFvg({
  template: `
    <fvg style="width:640px; height:360px">
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
  <fvg style="width:640px; height:360px">
    <Arrow x1={280} y1={200} x2={420} y2={200} stroke="#333" strokeWidth={6} />
  </fvg>,
)
```

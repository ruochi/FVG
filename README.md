# Flex Layer

Flex Layer 是面向 **AI agent** 的代码生图工具。Agent 用标签写出一帧画面，渲染器把它变成 PNG，并交回一份能按节点改回去的布局报告。

图形用 SVG 的写法，文字用 HTML 的写法，排布用 CSS flexbox。交接格式是一份 `.layer` 文本。规范是 [SPEC.md](SPEC.md)，给模型的一页规则是 [docs/CHEATSHEET.md](docs/CHEATSHEET.md)，agent 的操作闭环是 [AI.md](AI.md)。当前版本是单帧 v0.1。

## 优势

Agent 要能改某一处、能查出为什么不对、再跑一遍还得到同一张图。Flex Layer 按这个来设计。

1. **画面就是代码。** 模型已经会写 HTML 和 SVG 式属性。海报、卡片、标注直接落成 `.layer`，循环和数据可以用 Vue 或 React 生成同一份文本。
2. **`.layer` 是唯一真相源。** 手写或框架只负责产出文本。渲染器只读这份文本，输出 PNG 和 `report.json`。改版式就改标签或生成脚本，图可以随时重渲。
3. **错误指回具体节点。** `check` 不出图，返回每个元素的 `path`、`box`、`ink` 和 `issues`。写错位置会带 `hint`。有 error 时退出码为 1，agent 按 `path` 改完再跑。需要看像素时再用 `render --debug --report`。
4. **写了就照做。** 数字是像素，y 轴向下。写明的尺寸和位置会严格使用。没写的（例如换行）由渲染器决定，并写进报告。
5. **生成和渲染分开。** 条件和重复结构留在 Vue / React。渲染器不跑框架，所以生成错误和版式错误可以分开查。动态画面改数据后重新生成 `.layer`，再 `check`。
6. **标签不够时仍留在同一棵树里。** `<draw>` 或 `draw={fn}` 在节点上做自定义绘制。阴影、模糊、玻璃等效果是属性，和布局报告走同一条路径。

给 agent 的循环：读速查 → 写 `.layer` → `check` → 按 `path` 改 → `render --report`。步骤见 [AI.md](AI.md)。

## 安装

需要 Node.js 20 或更高版本。

```bash
npm install
npm run build
```

默认字体是寒蝉端黑体。`Song`（宋体）、`Kai`（楷体）、`Brush`（书法）也是内置的，第一次用到时下载到 `~/.cache/flexlayer/fonts`。

## 命令

```bash
npx tsx src/cli.ts render examples/hello.layer -o hello.png --report hello.json
npx tsx src/cli.ts render examples/draw-layer.layer -o draw-layer.png   # Layer + <draw>
npx tsx src/cli.ts render examples/hello.layer --debug --scale 0.5
npx tsx src/cli.ts check examples/hello.layer
```

构建之后也可以：

```bash
node dist/cli.js render examples/hello.layer -o hello.png
```

有 error 级别问题时，命令退出码为 1。

## 代码调用

```ts
import { renderFlexLayer } from '@dc/flexlayer'

const { png, report } = await renderFlexLayer(source, { scale: 0.5 })
```

嵌套 `Layer` **不填背景**（只合成子元素）。色块用 `Rect` / HTML，或 `.layer` 里的 `<draw>` / 程序侧 `draw={fn}`：

```html
<Layer width="400" height="300" background="#0f1115">
  <Layer width="160" height="80" cx="200" cy="150">
    <draw>
      ctx.fillStyle = '#3ecfc4'
      ctx.fillRect(0, 0, el.w, el.h)
    </draw>
  </Layer>
</Layer>
```

用 `h()` 或 JSX 时，任意元素可挂 `draw={(ctx, el) => { ... }}`，再交给 `renderFlexLayer(root)`：

```ts
import { h, renderFlexLayer } from '@dc/flexlayer'

const root = h(
  'Layer',
  { width: '400', height: '300', background: '#fff' },
  h(
    'h1',
    {
      cx: '200',
      cy: '150',
      draw: (ctx, el) => {
        ctx.strokeStyle = el.computed.color
        ctx.strokeRect(0, 0, el.w, el.h)
      },
    },
    '标题',
  ),
)

await renderFlexLayer(root)
```

按帧生成一组 PNG 和一张联系表：

```ts
import { h, renderComposition, type Composition } from '@dc/flexlayer'

const scene: Composition = {
  id: 'slide',
  width: 32,
  height: 32,
  fps: 4,
  durationInFrames: 4,
  component: ({ frame }) =>
    h(
      'Layer',
      { width: '32', height: '32', background: '#000' },
      h('Rect', { width: '8', height: '32', cx: String(4 + frame * 8), cy: '16', fill: '#fff' }),
    ),
}

const { frames, contactSheet } = await renderComposition(scene)
```

`draw` 里通过 `el.t` 读取秒数（`frame / fps`）。不传 `t` 的单帧渲染里，`el.t` 为 `0`。

嵌套的 `Layer` 可以当分组：外层的 `rotate`、`scale`、`opacity` 作用到整棵子树，子元素用组内坐标。

```tsx
h(
  'Layer',
  { cx: '200', cy: '200', width: '120', height: '80', scale: '1.2', origin: 'center' },
  h('Rect', { cx: '60', cy: '40', width: '120', height: '80', fill: '#fff' }),
  h('Layer', { cx: '30', cy: '20', width: '40', height: '40' }, h('Circle', { cx: '20', cy: '20', r: '8', fill: '#3ecfc4' })),
)
```

## 测试

```bash
npm test
```

## 许可

MIT，见 [LICENSE](LICENSE)。

# FVG

FVG（Flex Vector Graphics）用标签描述一帧画面：图形用 SVG 的写法，文字用 HTML 的写法，布局用 CSS flexbox。渲染器读入 `.fvg`，输出 PNG 和一份布局报告。

规范见 [SPEC.md](SPEC.md)。给模型用的一页规则见 [docs/CHEATSHEET.md](docs/CHEATSHEET.md)。当前版本是单帧 v0.1。

## 安装

需要 Node.js 20 或更高版本。

```bash
npm install
npm run build
```

默认字体是寒蝉端黑体。第一次渲染时会下载到 `~/.cache/fvg/fonts`。

## 命令

```bash
npx tsx src/cli.ts render examples/hello.fvg -o hello.png --report hello.json
npx tsx src/cli.ts render examples/hello.fvg --debug --scale 0.5
npx tsx src/cli.ts check examples/hello.fvg
```

构建之后也可以：

```bash
node dist/cli.js render examples/hello.fvg -o hello.png
```

有 error 级别问题时，命令退出码为 1。

## 代码调用

```ts
import { renderFvg } from '@dc/fvg'

const { png, report } = await renderFvg(source, { scale: 0.5 })
```

用 `h()` 或 JSX 构建节点时，可给任意元素挂 `draw={(ctx, el) => { ... }}`，再交给 `renderFvg(root)`：

```ts
import { h, renderFvg } from '@dc/fvg'

const root = h(
  'fvg',
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

await renderFvg(root)
```

按帧生成一组 PNG 和一张联系表：

```ts
import { h, renderComposition, type Composition } from '@dc/fvg'

const scene: Composition = {
  id: 'slide',
  width: 32,
  height: 32,
  fps: 4,
  durationInFrames: 4,
  component: ({ frame }) =>
    h(
      'fvg',
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

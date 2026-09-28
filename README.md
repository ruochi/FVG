# FVG

FVG（Flex Vector Graphics）用标签描述一帧画面：图形用 SVG 的写法，文字用 HTML 的写法，布局用 CSS flexbox。渲染器读入 `.fvg`，输出 PNG 和一份布局报告。

规范见 [SPEC.md](SPEC.md)。用 Vue 或 React **动态生成** `.fvg` 见 [GENERATE.md](GENERATE.md)。当前版本是单帧 v0.1。

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
npx tsx src/cli.ts debug examples/hello.fvg --scale 0.5
npx tsx src/cli.ts render examples/poster-solstice.fvg -o poster.png   # 夏至放映
npx tsx src/cli.ts debug examples/poster-solstice.fvg --focus moon
npx tsx src/cli.ts debug examples/poster-frost.fvg --scale 0.5 --focus 2   # 霜降书市，带调试图
```

写法：要落在 layer 坐标上的（`cx`、`cy`、`anchor`、`x1`、`y1`、`points`、`d`）写成标签属性，其余都写进 `style`：

```html
<circle cx="540" cy="1300" style="r:180px; fill:none; stroke:#f7931a; stroke-width:12px; glow:36px" />
```

构建之后也可以：

```bash
node dist/cli.js render examples/hello.fvg -o hello.png
```

有 error 级别问题时，命令退出码为 1。

## 代码调用

```ts
import { renderFvg, debugFvg } from '@dc/fvg'

const { png, report } = await renderFvg(source, { scale: 0.5 })
const debug = await debugFvg(source, { scale: 0.5, focus: ['title'] })
```

## 测试

```bash
npm test
```

## 许可

MIT，见 [LICENSE](LICENSE)。

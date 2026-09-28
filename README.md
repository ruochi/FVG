# FVG

FVG（Flex Vector Graphics）用标签描述一帧画面：图形用 SVG 的写法，文字用 HTML 的写法，布局用 CSS flexbox。渲染器读入 `.fvg`，输出 PNG 和一份布局报告。

规范见 [SPEC.md](SPEC.md)。当前版本是单帧 v0.1。

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

## 测试

```bash
npm test
```

## 许可

MIT，见 [LICENSE](LICENSE)。

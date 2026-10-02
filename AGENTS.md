# Flex Layer：生成、验证与 AI 协作

本文是给模型的入口。标签与属性的正文只在 [SPEC.md](SPEC.md)；下面这张表是必须遵守的写法，和报告里的问题码一一对应。Vue / React 见 [GENERATE.md](GENERATE.md)；组件见 [generate/COMPONENTS.md](generate/COMPONENTS.md)；效果图见 [docs/GALLERY.md](docs/GALLERY.md)。

## 1. 三层分工

Flex Layer 把**生成**和**渲染**分开，中间只交接一份 **`.layer` 文本**：

```text
生成（手写 / Vue / React） → .layer 文本 → check / debug / render → PNG
```

| 层 | 做什么 | 不做什么 |
| --- | --- | --- |
| **生成** | 产出合法 `.layer` 字符串 | 不算最终像素、不画 canvas |
| **验证** | 布局、问题码、元素表、调试图 | 不改源码 |
| **渲染** | 读 `.layer` → PNG + `report.json` | 不跑 Vue / React |

`.layer` 或生成它的脚本是可版本化的产物。PNG 和 debug 目录是验证结果，用来迭代。

## 2. 硬性约定

规则正文在 SPEC。这里只列写错会怎样、应该改成什么。

| 规则 | 错误写法 | 正确写法 | 问题码 |
| --- | --- | --- | --- |
| HTML 用 `style`，`Layer` 和图形用属性 | `<p font-size="40">`、`<Circle style="fill:#fff">` | `<p style="font-size:40px">`、`<Circle fill="#fff">` | `invalid-attr` |
| 根与定位用大写 `Layer`，图形首字母大写 | `<circle>`、`<Row>` | `<Circle>`、`<div style="display:flex">` | `unknown-tag` |
| 嵌套 `Layer` / `use` 不写 `background` | `<Layer background="#fff">` | `<Rect fill="#fff">`、HTML `background`，或 `<draw>` | `invalid-attr` |
| 排布用 `div` 的 `display:flex` | `<Column>` | `<div style="display:flex; flex-direction:column">` | `unknown-tag` |
| 线条放在 `Layer` 里，用 `x1`…`d` | 线条直接放进 flex | `<Layer><Line x1 y1 x2 y2 /></Layer>` | `invalid-child` |
| 文字的位置写在外包的 `Layer` 上 | `<h1 cx="120">` | `<Layer cx="120" cy="64" anchor="top-left"><h1>…</h1></Layer>` | `invalid-attr` |
| 图片是 HTML | `<Image width="320">` | `<img src="cover.png" style="width:320px; height:180px">`。`image` 同样可用 | `invalid-attr` |
| 作用于整棵子树的效果只写在 `Layer` 上 | `<Rect grade="lomo">`、`<p style="overlay:#000">` | `<Layer grade="lomo" overlay="#00000066">` | `invalid-attr` |
| 调色先选预设再改一两项 | `grade="contrast 5"` | `<Layer grade="lomo 0.8, fade 0.1">` | `invalid-attr` |
| 多段文字用 flex | `<p><div>…</div></p>` | `<div style="display:flex; flex-direction:column">` | `invalid-child` |

根节点 `<Layer width height background>` 上的 `background` 是画布底色，只有这一处可以写。

## 3. 生成

- 直接写 `.layer`：海报、单帧。速查见 [docs/CHEATSHEET.md](docs/CHEATSHEET.md)，例子在 [examples/](examples/)。
- Vue：循环和 `:cx` 用模板算。抄 [generate/vue/example.ts](generate/vue/example.ts)。模板会压空白，`<draw>` 里多句 JS 写在一行并用 `;` 分隔。
- React：抄 [generate/react/example.tsx](generate/react/example.tsx)。大写标签从 `generate/react/tags.ts` 引入，因为 React 会把大写 JSX 当成变量。

```ts
import { renderLayer } from 'flexlayer'
const { png, report } = await renderLayer(source, { baseDir: process.cwd() })
```

## 4. 验证：由轻到重

### 4.1 `flexlayer check`

只跑布局与规则检查，不出图。有 **error** 时进程退出码为 1。

```bash
npx tsx src/cli.ts check examples/hello.layer
```

### 4.2 `flexlayer render --report`

```bash
npx tsx src/cli.ts render scene.layer -o scene.png --report scene.json
```

`--scale 0.5` 可缩小 PNG。

### 4.3 `flexlayer render --debug`

在同一张 PNG 上画出每个元素的布局盒子和着墨范围。先读报告里的 `issues`，再看图。

### 4.4 报告里关键字段

- **`path`**：如 `Layer/Layer[0]/div[0]/h1[0]`，与 `issues[].path` 一致。
- **`box`**：布局盒（含 padding）；flex 的 `gap` 体现在相邻元素 box 之间的空隙。
- **`ink`**：字形或图形真实着墨。核对字距看 ink 与 ink。
- **`effect`**：阴影 / 光晕可能占用的范围；`effect-clipped` 表示被画布裁切。
- **`issues`**：见 [SPEC.md 的问题码表](SPEC.md)。**error 必须修**，warn 视需求修。`grade` 回显的是预设展开后的参数。

## 5. 工作流

```mermaid
flowchart TD
  readSpec[读硬性约定与速查] --> write[写 .layer 或 Vue/React 生成]
  write --> check[flexlayer check]
  check -->|有 error| fix[按 path 和 hint 改 markup]
  fix --> check
  check -->|通过或仅 warn| debug["render --debug --report"]
  debug --> readReport[读 issues 和 box]
  readReport -->|间距或对齐不对| fix
  readReport -->|满意| render[render 出最终 PNG]
```

1. 先对照第 2 节写，再看像素。
2. 用 `path` 定位，不要猜第几个 child。
3. 改 `gap` / `padding` 时看相邻元素的 box / ink。
4. 动态海报在 Vue / React 里改数据，重新生成 `.layer`，再跑 check。
5. 字体用根上的 `<font family src>`，或内置名 `Song`、`Kai`、`Brush`。

## 6. 现象怎么查

| 现象 | 建议 |
| --- | --- |
| 元素跑出画布 | `overflow-canvas`；看 `ink` / `box` 与画布尺寸 |
| 光晕被裁切 | `effect-clipped`；缩小 glow 或移动元素 |
| 字距和 `gap` 不一致 | 看 debug 里的 ink 间距 |
| flex 子项被挤爆 | 加宽 flex 容器或缩小子项 |
| 阴影或光晕看不见 | 查颜色与背景对比；看 `effect` 矩形 |
| 嵌套 Layer 写了 background 没颜色 | 改成 `Rect`、HTML `background` 或 `<draw>` |
| 不知道改哪个节点 | 报告里的 `path` 和 `hint` |

## 7. 文档索引

| 文档 | 内容 |
| --- | --- |
| [SPEC.md](SPEC.md) | 唯一规范：标签、属性、效果、问题码 |
| [docs/CHEATSHEET.md](docs/CHEATSHEET.md) | 一页写法 |
| [docs/GALLERY.md](docs/GALLERY.md) | 效果对应哪张图的哪一格 |
| [docs/EFFECTS.md](docs/EFFECTS.md) | 算法与实现备注 |
| [GENERATE.md](GENERATE.md) | Vue / React 怎么生成 `.layer` |
| [README.md](README.md) | 安装与命令 |
| **本文** | 硬性约定和验证闭环 |

自动化测试：`npm test`（渲染器，含效果图与示例的检测）；`npm run test:generate`（生成层）。`npm run gallery` 检测 gallery 与 examples，有 error 则失败，并重渲染说明里的图。

# FVG 规范 v0.1（Flex Vector Graphics）

FVG 用标签描述**一帧画面**：图形用 SVG 的写法，文字用 HTML 的写法，布局用 CSS flexbox。
动画 = 程序为每个时刻生成一份 FVG（v0.2 起）。

设计原则：

1. **一律实际像素**：所有数字都是像素，可以写 `px` 后缀，不支持百分比、em、rem。
2. **中心点定位**：自由摆放时用 `cx`、`cy` 表示元素中心，所有元素都一样。
3. **y 轴向下**：和 Canvas、HTML 一致，`cy="400"` 表示距离父级顶部 400 像素。
4. **显式写了就照做**：写了尺寸、位置就严格使用，不会被悄悄改掉；有问题只在报告里指出。
5. **没写的由渲染器决定，并写进报告**：比如自动换行。

## 1. 文件结构

```html
<fvg width="1080" height="1920" background="#0f1115" color="#ffffff">
  <font family="DeYiHei" src="https://example.com/deyihei.otf" />
  <Column cx="540" cy="700" style="gap:32px">
    <h1>比特币减半</h1>
    <p style="color:#f7931a">每四年一次</p>
  </Column>
</fvg>
```

根元素 `<fvg>` 本身就是一个 `Layer`（见下文），属性：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `width`、`height` | 必填 | 画布尺寸 |
| `background` | `#ffffff` | 画布背景色，写 `transparent` 输出透明 PNG |
| `color` | `#111111` | 全局文字色、线条默认色 |
| `font-family` | `ChillDuanSans` | 全局字体（寒蝉端黑体） |
| `safe` | 画布短边的 4% | 安全区边距，`上 右 下 左` 或一个数字，只用于检查 |

`<font family="名字" src="路径或网址" />` 注册额外字体，只能写在根元素下。

## 2. 元素一览

| 类别 | 标签 |
| --- | --- |
| 容器 | `Layer`、`Row`、`Column` |
| 文字 | `h1`、`h2`、`h3`、`p`、`div`、`span`；行内：`span`、`strong`、`b`、`em`、`br` |
| 公式 | `math`（MathML 子集，见 4.3） |
| 形状 | `Rect`、`Circle`、`Ellipse` |
| 线条 | `Line`、`Arrow`、`Polyline`、`Polygon`、`Path` |

- 容器和形状首字母大写，文字标签全部小写（和 HTML 一样）。
- 后写的元素画在上面。
- 不认识的标签会被忽略，并在报告里给出警告。

## 3. 通用属性

| 属性 | 说明 |
| --- | --- |
| `id` | 报告里用来指认元素 |
| `cx`、`cy` | 在 `Layer` 里的定位点，默认是元素中心（见 `anchor`）；在 `Row`/`Column` 里无效 |
| `anchor` | 定位点在元素上的哪个位置，九宫格：`center`（默认）、`top`、`bottom`、`left`、`right`、`top-left`、`top-right`、`bottom-left`、`bottom-right` |
| `opacity` | 0 到 1 |
| `rotate` | 绕元素中心旋转，单位度，顺时针为正 |
| `scale` | 绕元素中心缩放 |

`rotate`、`scale` 只影响绘制，不影响布局；报告里的盒子是变换前的。

没写 `cx`、`cy` 时，默认放在父级 `Layer` 的中心。

`anchor` 示例：`<h1 cx="60" cy="120" anchor="top-left">` 表示标题左上角在 (60, 120)，也就是左对齐排版。

## 4. 容器

### 4.1 Layer：自由摆放

子元素用 `cx`、`cy` 在 Layer 的局部坐标里定位，原点是 Layer 的左上角。

- 写了 `width`、`height`：Layer 就是这么大。
- 没写：Layer 的大小等于所有子元素盒子的并集，也就是自动包住内容。

`style` 支持 `background`、`border`、`border-radius`。

### 4.2 Row、Column：flex 排列

`Row` 横向排列，`Column` 纵向排列，子元素的 `cx`、`cy` 无效。

`style` 支持的属性：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `width`、`height` | 包住内容 | 外框尺寸（含 padding 和 border） |
| `gap` | `0` | 子元素间距 |
| `padding` | `0` | 1 到 4 个值，同 CSS |
| `align-items` | `center` | `start`、`center`、`end`、`stretch`（注意默认值和 CSS 不同） |
| `justify-content` | `start` | `start`、`center`、`end`、`space-between`、`space-around`、`space-evenly` |
| `background`、`border`、`border-radius` | 无 | 同 CSS，border 只支持实线 |

子元素可以写的 flex 属性：`flex-grow`、`flex-shrink`、`align-self`、`width`、`height`。

- 文字默认 `flex-shrink:1`，空间不够时会换行变窄，但不会窄过最长的一个不可断开的词。
- 形状和公式默认 `flex-shrink:0`，不会被压扁。

**可用宽度**：放在 Layer 里、没写 `width` 的 Row/Column，最宽只能到 Layer 的宽度（根 Layer 要减去左右安全区）。

### 4.3 math：公式

`<math>` 是布局节点，可以放在 `Layer`、`Row`、`Column` 里，不能放进文字盒子。和正文同一行时，用 `Row` 把文字和公式排在一起。

字号默认 40px，也可用 `style="font-size:…"`。公式内部的 em 按这一层字号换成像素。公式不换行。

支持的标签：`math`、`mrow`、`mi`、`mn`、`mo`、`mtext`、`mfrac`、`msub`、`msup`、`msubsup`、`msqrt`、`mroot`、`munder`、`mover`、`munderover`、`mtable`、`mtr`、`mtd`。

- `math`、`mrow` 横向排列，间距为 0。运算符左右空隙由运算符本身决定。
- `mfrac` 是分子、分数线、分母。分子分母字号为 0.85 倍，线上下各留 0.28em。
- `msub`、`msup`、`msubsup` 的上下标在基座旁边，`msubsup` 叠在同一列。求和、连乘和 `lim` 等的上下标改到基座正上、正下。积分号放大 1.35 倍，上下限在符号右侧。
- `msqrt` 左侧是随内容变高的根号笔画。`mroot` 的指数在根号左上。
- `mtable` 按行排列，行距 0.2em，单元格间距 0.45em。

间距规则见 [MATHML.md](MATHML.md)。

## 5. 文字

最外层的文字标签是一个**文字盒子**，里面只能放文字和行内标签（`span`、`strong`、`b`、`em`、`br`）。
要排列多段文字，请用 `Row`/`Column`，不要在文字盒子里嵌套 `div`、`p`。公式写在同级的 `<math>` 里，不要写进文字盒子。

### 5.1 默认样式

| 标签 | 字号 | 字重 |
| --- | --- | --- |
| `h1` | 88px | bold |
| `h2` | 64px | bold |
| `h3` | 48px | bold |
| `p`、`div`、`span` | 40px | normal |

### 5.2 style 属性

| 属性 | 说明 |
| --- | --- |
| `font-size`、`font-weight`、`font-family`、`color`、`letter-spacing` | 同 CSS，行内标签也可以写 |
| （字重规则） | 仅 `ChillDuanSans`（寒蝉端黑体）使用元素指定的 `font-weight`；其它 `font-family` 在测量与绘制时一律按 `normal`（400） |
| `line-height` | 倍数，单行默认 1.2，多行默认 1.4 |
| `text-align` | `left`（默认）、`center`、`right` |
| `width`、`height` | 外框尺寸（含 padding 和 border） |
| `max-width` | 最大外框宽度，超出就换行，盒子贴合最长的一行 |
| `padding`、`background`、`border`、`border-radius` | 同 CSS |
| `white-space: nowrap` | 禁止换行 |
| `text-wrap` | `balance`（默认，各行长度尽量均匀）或 `wrap`（尽量填满每一行） |

### 5.3 换行规则

1. 写了 `width`：按内容宽度换行。
2. 写了 `max-width`：超出才换行。
3. 都没写：默认一行；如果一行超出可用宽度，自动换行，报告里记为 `auto-wrap`。
4. 中文可以在任意两个字之间断行；英文单词和连续数字不会被拆开。
5. 避头尾：`，。、；：？！）」』》】…` 等不会出现在行首，`（「『《【` 等不会出现在行尾。
6. 硬换行只用 `<br>`，源码里的换行和连续空格会被折叠成一个空格。

## 6. 形状

| 标签 | 尺寸属性 |
| --- | --- |
| `Rect` | `width`、`height`、`rx`（圆角） |
| `Circle` | `r` |
| `Ellipse` | `rx`、`ry` |

绘制属性和 SVG 一致：`fill`（默认 `#000000`，写 `none` 不填充）、`stroke`（默认 `none`）、`stroke-width`（默认 1）、`stroke-dasharray`。

形状可以放在 Layer 里（用 `cx`、`cy` 定位），也可以放在 Row/Column 里参与排列。

## 7. 线条

| 标签 | 属性 |
| --- | --- |
| `Line` | `x1`、`y1`、`x2`、`y2` |
| `Arrow` | `x1`、`y1`、`x2`、`y2`、`head`（箭头长度，默认 `stroke-width` 的 4 倍，最小 12） |
| `Polyline`、`Polygon` | `points="x,y x,y …"` |
| `Path` | `d`（SVG 路径语法） |

- 线条只能放在 Layer 里，坐标是 **Layer 的局部坐标**（和 SVG 一样，不用 `cx`、`cy`）。
- `stroke` 默认是全局 `color`，`stroke-width` 默认 4（注意和 SVG 不同：SVG 默认不描边，线条会看不见）。
- `Polygon`、`Path` 的 `fill` 默认 `none`。
- 还支持 `stroke-linecap`、`stroke-linejoin`、`stroke-dasharray`。

## 8. 布局报告

渲染时同时输出一份 JSON 报告：

```json
{
  "fvg": "0.1",
  "width": 1080,
  "height": 1920,
  "elements": [
    {
      "path": "fvg/Column[0]/h1[0]",
      "id": "title",
      "tag": "h1",
      "box": { "x": 330, "y": 600, "width": 420, "height": 106, "left": 330, "top": 600, "right": 750, "bottom": 706, "centerX": 540, "centerY": 653 },
      "ink": { "...": "字形或图形实际着墨的范围，字段同 box" },
      "fontSize": 88,
      "lines": [{ "text": "比特币减半", "box": { "...": "..." } }]
    }
  ],
  "issues": [
    { "level": "error", "code": "overflow-canvas", "path": "fvg/p[2]", "message": "…" }
  ]
}
```

- `box`：布局盒子（含 padding 和 border），坐标相对画布左上角。
- `ink`：实际着墨范围。文字是字形的真实边界，形状包含描边宽度。

检查项：

| code | 级别 | 含义 |
| --- | --- | --- |
| `overflow-canvas` | error | 着墨超出画布 |
| `outside-safe` | warn | 文字超出安全区 |
| `text-overflow` | error | 文字超出了写死的宽度或高度 |
| `flex-overflow` | warn | 子元素超出了写死尺寸的 Row/Column |
| `text-overlap` | warn | 两段文字的着墨区域重叠 |
| `min-font-size` | warn | 字号小于 `画布宽度 / 1080 × 24` |
| `auto-wrap` | info | 文字超出可用宽度，被自动换行 |
| `unknown-tag`、`invalid-attr` | warn | 不认识的标签，或无法解析的属性值 |
| `invalid-child` | warn | 非法子元素（如 `Line`/`Path` 放在 `Row`/`Column` 内，或 `<math>` 放进文字盒子） |

## 9. 命令行

```bash
fvg render scene.fvg -o scene.png --report scene.json   # 渲染 PNG + 报告
fvg render scene.fvg --debug                             # 叠加画出盒子（蓝）和着墨范围（红）
fvg render scene.fvg --scale 0.5                         # 缩小输出，方便 AI 快速查看
fvg check scene.fvg                                      # 只输出检查结果，不出图
```

默认字体寒蝉端黑体首次使用时自动下载到 `~/.cache/fvg/fonts`。

## 10. 自定义绘制 draw

程序调用（React / Vue JSX 或 `h()`）时，任意元素可挂 `draw={(ctx, el) => { ... }}`。纯 `.fvg` 文本和 CLI 无法携带函数，行为与 v0.1 相同。

绘制顺序：先画该元素默认内容（文字、形状、线条、子节点），再调用 `draw`。`ctx` 原点在元素左上角，坐标范围 `(0,0)` 到 `(el.w, el.h)`；渲染器会先平移到该盒子，再绕中心应用元素的 `rotate`、`scale`（与形状一致）。`opacity` 由外层统一乘到 `globalAlpha`。

`el` 字段：

| 字段 | 说明 |
| --- | --- |
| `tag`、`id` | 标签名与 `id` |
| `text` | 该节点直接文本子节点（不含行内标签内的字） |
| `attr` | 标签原始属性（含 `cx`、`cy`、`anchor`、`style` 字符串等） |
| `style` | 本标签 `style` 解析后的键值 |
| `computed` | `color`、`fontFamily`、`fontSize`、`fontWeight`、`opacity`（继承根上的 `color` / `font-family` 与文字默认字号） |
| `w`、`h` | 布局外框宽高 |

未知标签若同时带有 `draw` 以及 `width` 与 `height`（属性或 `style`），会当作自定义盒子参与布局，不再报 `unknown-tag`；缺少尺寸时仍警告并跳过。

```ts
import { h, renderFvg } from '@dc/fvg'

const root = h('fvg', { width: '1080', height: '1920', background: '#0f1115', color: '#ffffff' },
  h('h1', {
    cx: '540', cy: '700', anchor: 'center',
    style: 'font-size:96px; color:#f7931a',
    draw: (ctx, el) => {
      ctx.strokeStyle = el.computed.color
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(0, el.h - 6)
      ctx.lineTo(el.w, el.h - 6)
      ctx.stroke()
    },
  }, '比特币减半'),
)

await renderFvg(root)
```

JSX 可将 `jsxImportSource` 设为 `@dc/fvg`，使用 `@dc/fvg/jsx-runtime`。

## 11. 帧序列

动画由程序按时间生成一棵 FVG 节点，再交给渲染器。`t` 的单位是秒。单帧 `renderFvg` 不传 `t` 时，`el.t` 为 `0`。

```ts
import { h, renderComposition, type Composition } from '@dc/fvg'

const scene: Composition = {
  id: 'halving',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 90,
  component: ({ frame, fps, t }) =>
    h('fvg', { width: '1080', height: '1920', background: '#0f1115' },
      h('h1', { cy: String(700 + Math.sin(t) * 40) }, '比特币减半'),
    ),
}

const { frames, contactSheet } = await renderComposition(scene)
```

`renderComposition` 对 `frame = 0 .. durationInFrames - 1` 调用 `component({ frame, fps, t: frame / fps })`，再 `renderFvg(node, { t })`。`fps` 必须大于 0，`durationInFrames` 为不小于 1 的整数。返回每一帧的 PNG，以及一张白色底的联系表：列数约为帧数的平方根，单元格按比例缩小，不放大。

随时间变化的位置、尺寸和文字写在 `component` 里，布局每一帧重新计算。`draw` 里用 `el.t` 读取同一个秒数。

三个纯函数不绘制画面：

| 函数 | 作用 |
| --- | --- |
| `interpolate(value, inputRange, outputRange)` | 线性映射，默认超出区间时钳制 |
| `spring({ frame, fps })` | 阻尼弹簧，从 0 趋近 1。`frame` 为 0 时是 0 |
| `sequence(input, { from, durationInFrames }, render)` | 当前帧落在区间内时，把减去 `from` 的局部 `frame` 和 `t` 交给 `render`；否则返回 `null` |

同一 `frame` 调用两次，得到同一张 PNG。命令行仍只渲染 `.fvg` 文件。

## 12. 预留（后续版本）

- 把帧序列编码成视频，以及时间轴预览。
- 墨迹布局：按着墨范围计算间距、居中、包裹。
- `Icon`、渐变、阴影、`Image`。
- 2.5D 与 3D：`rotateX`、`rotateY`、`z`、`perspective`、`Scene3D` 这些名字已保留，不要挪作他用。

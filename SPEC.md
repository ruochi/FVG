# FVG 规范 v0.1（Flex Vector Graphics）

FVG 用标签描述**一帧画面**。HTML 标签用 `style`，其余标签用属性。结构标签只有 `Layer`。文字用 HTML 写法，排布用 `display:flex`，图形用 SVG 属性。
动画 = 程序为每个时刻生成一份 FVG（v0.2 起）。

设计原则：

1. **一律实际像素**：所有数字都是像素，可以写 `px` 后缀，不支持百分比、em、rem。
2. **位置由 Layer 决定**：`Layer` 负责定位，`display:flex` 的 HTML 负责排布。图形用自身坐标画在 Layer 里。
3. **y 轴向下**：和 Canvas、HTML 一致，`cy="400"` 表示距离父级顶部 400 像素。
4. **显式写了就照做**：写了尺寸、位置就严格使用，不会被悄悄改掉；有问题只在报告里指出。
5. **没写的由渲染器决定，并写进报告**：比如自动换行。
6. **写错了要说怎么改**：有歧义或会被忽略的写法报 `warn` 并给出 `hint`；含义明确但不规范的写法照常渲染，报 `info`。不认识的属性名一律保留，给 `draw` 用。

## 1. 文件结构

```html
<fvg width="1080" height="1920" background="#0f1115" color="#ffffff">
  <font family="DeYiHei" src="https://example.com/deyihei.otf" />
  <Layer cx="540" cy="700">
    <div style="display:flex; flex-direction:column; gap:32px; align-items:center">
      <h1>比特币减半</h1>
      <p style="color:#f7931a">每四年一次</p>
    </div>
  </Layer>
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
| 容器 | `Layer`。横排竖排用带 `display:flex` 的 `div` |
| 文字 | `h1`、`h2`、`h3`、`p`、`div`、`span`；行内：`span`、`strong`、`b`、`em`、`br` |
| 形状 | `Rect`、`Circle`、`Ellipse` |
| 线条 | `Line`、`Arrow`、`Polyline`、`Polygon`、`Path` |

- `Layer` 和图形首字母大写，文字标签全部小写（和 HTML 一样）。HTML 只写 `style`，`Layer` 和图形只写属性。
- 后写的元素画在上面。
- 不认识的标签会被忽略，并在报告里给出警告。

## 3. 通用属性

| 属性 | 说明 |
| --- | --- |
| `id` | 报告里用来指认元素 |
| `cx`、`cy` | 只写在 `Layer` 上，默认是该层中心（见 `anchor`） |
| `anchor` | 定位点在元素上的哪个位置，九宫格：`center`（默认）、`top`、`bottom`、`left`、`right`、`top-left`、`top-right`、`bottom-left`、`bottom-right` |
| `opacity` | 0 到 1。嵌套时逐层相乘 |
| `rotate` | 绕 `origin` 旋转，单位度，顺时针为正。对文字、线条、形状和 Layer 都生效；Layer 上的旋转作用到整棵子树 |
| `scale` | 绕 `origin` 缩放，同样作用到整棵子树 |
| `origin` | 旋转和缩放的支点，取值和 `anchor` 一样，默认 `center` |

`rotate`、`scale` 只影响绘制，不影响布局。报告里的 `box` 是变换前的布局盒子（只累加平移），`ink` 是变换后的外接矩形。

属性归属：

| 属性 | 写在哪 |
| --- | --- |
| `cx`、`cy`、`anchor`、`width`、`height`、`opacity`、`rotate`、`scale`、`origin` | `Layer` 的属性。HTML 上写了报 `warn` |
| `flex`、`gap`、`align-items`、字号、颜色、背景 | HTML 的 `style`。`Layer` 或图形写了 `style` 报 `warn` |
| `x1`、`y1`、`x2`、`y2`、`points`、`d`、`fill`、`stroke` | 图形属性，坐标是所在 `Layer` 的局部坐标 |

叶子的定位：

| 叶子 | 怎么定位 |
| --- | --- |
| 文字，以及没写宽高的一组 HTML | 外包一层 `Layer`，把 `cx`、`cy`、`anchor` 写在 `Layer` 上 |
| 形状、带 `draw` 和尺寸的自定义元素 | 中心写法（`cx`、`cy` 永远是中心）或两点写法 `x1 y1 x2 y2`。尺寸是自己写的，不用 `anchor` |
| 线条 | 端点、`points`、`d` 本身就是坐标，不写 `cx`、`cy` |

没写 `cx`、`cy` 时，默认放在父级 `Layer` 的中心。

`anchor` 示例：`<Layer cx="60" cy="120" anchor="top-left"><h1>标题</h1></Layer>` 表示这一层的左上角在 (60, 120)。

## 4. 容器

### 4.1 Layer：自由摆放，也可以当分组

原点是 Layer 的左上角。图形和嵌套 Layer 用 `cx`、`cy` 或自身坐标定位；HTML 不写 `cx`，要单独摆放就再包一层 Layer。Layer 可以嵌套。外层的 `opacity`、`rotate`、`scale` 会作用到里面的全部子元素，所以一组要一起移动、旋转或缩放时，包一层 Layer 即可。

- 写了 `width`、`height`：Layer 就是这么大，原点固定。内容可以画出盒子。做动画的分组建议写上宽高，这样坐标不会跟着内容变。
- 没写：宽高等于从原点到内容右下角的距离，没写 `cx`、`cy` 的子元素放在这个盒子的中心。坐标在负方向的子元素会画到盒子外面，但不会把其他子元素一起平移。

`overflow="hidden"` 按 Layer 的盒子裁剪子元素。默认 `visible`。

`background`、`border`、`border-radius`、`overflow` 写在 `Layer` 的属性上，不写 `style`。

一组 HTML 要放到画面上，包一层 `Layer`，把 `cx`、`cy`、`anchor` 写在 `Layer` 上。

```html
<Layer cx="120" cy="64" anchor="top-left">
  <div style="display:flex; gap:40px; align-items:center">
    <h2 style="font-size:56px">勾股定理</h2>
  </div>
</Layer>
```

### 4.2 flex：HTML 排布

`display:flex` 把 `div`（以及其他文字标签）变成排布容器，不再当文字盒子。默认横向。竖排写 `flex-direction:column`。子元素是文字、flex 容器或 `Layer`。

图形要放进 flex，包一层写了宽高的 `Layer`，或者改用 `div` 盒子（`width`、`height`、`background`、`border-radius`）。形状直接放进来会照尺寸渲染并报 `info`；线条直接放进来不渲染，报 `warn`。两点坐标写在 flex 里的形状上不渲染，报 `warn`。

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
- 形状默认 `flex-shrink:0`，不会被压扁。

**可用宽度**：放在 Layer 里、没写 `width` 的 flex 容器，最宽只能到 Layer 的宽度（根 Layer 要减去左右安全区）。

## 5. 文字

最外层的文字标签是一个**文字盒子**，里面只能放文字和行内标签（`span`、`strong`、`b`、`em`、`br`）。
要排列多段文字，请用 `<div style="display:flex; flex-direction:column">`，不要在普通文字盒子里嵌套 `div`、`p`。

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

两种写法只能选一种。两点可以反着写，取最小最大。`Circle` 只有中心写法。

| 标签 | 中心写法 | 两点写法 |
| --- | --- | --- |
| `Rect` | `cx` `cy` `width` `height`，另有 `rx`（圆角） | `x1` `y1` `x2` `y2`，对角两个角 |
| `Ellipse` | `cx` `cy` `rx` `ry` | `x1` `y1` `x2` `y2`，外接矩形的对角 |
| `Circle` | `cx` `cy` `r` | 不支持 |

`Rect` 写 SVG 的 `x` `y` `width` `height` 时，按左上角渲染，并报 `info`。形状上写 `anchor` 也照做，并报 `info`。

绘制属性和 SVG 一致：`fill`（默认 `#000000`，写 `none` 不填充）、`stroke`（默认 `none`）、`stroke-width`（默认 1）、`stroke-dasharray`。

带 `draw` 且写了尺寸的自定义元素，定位和形状相同。

## 7. 线条

| 标签 | 属性 |
| --- | --- |
| `Line` | `x1`、`y1`、`x2`、`y2` |
| `Arrow` | `x1`、`y1`、`x2`、`y2`、`head`（箭头长度，默认 `stroke-width` 的 4 倍，最小 12） |
| `Polyline`、`Polygon` | `points="x,y x,y …"` |
| `Path` | `d`（SVG 路径语法） |

- 线条只能放在 Layer 里，坐标是 **Layer 的局部坐标**（和 SVG 一样，不用 `cx`、`cy`）。写了 `cx`、`cy` 会忽略并报 `warn`。
- 布局盒子是纯几何范围，水平线的高度可以是 0。描边和箭头只算进报告的 `ink`。
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
      "path": "fvg/Layer[0]/div[0]/h1[0]",
      "id": "title",
      "tag": "h1",
      "box": { "x": 330, "y": 600, "width": 420, "height": 106, "left": 330, "top": 600, "right": 750, "bottom": 706, "centerX": 540, "centerY": 653 },
      "ink": { "...": "变换并裁剪后的着墨外接矩形，字段同 box" },
      "opacity": 1,
      "fontSize": 88,
      "lines": [{ "text": "比特币减半", "box": { "...": "..." } }]
    }
  ],
  "issues": [
    { "level": "warn", "code": "invalid-child", "path": "fvg/div[0]/Line[0]", "message": "线条不能放在 flex 容器内", "hint": "包一层 Layer，例如 <Layer><Line …/></Layer>" }
  ]
}
```

- `box`：布局盒子（含 padding 和 border），只累加平移，不受 `rotate`、`scale` 影响。
- `ink`：实际着墨经过旋转、缩放之后的外接矩形，并和祖先里 `overflow="hidden"` 的 Layer 求过交集。文字是字形的真实边界，形状是布局盒子变换后的范围。
- `opacity`：从根到该元素逐层相乘后的透明度。

`opacity` 小于 0.01 的元素仍会出现在 `elements` 里，但不参与下面的越界、安全区、重叠和最小字号检查。最小字号按声明的 `font-size` 判断，不乘 `scale`。

检查项：

| code | 级别 | 含义 |
| --- | --- | --- |
| `overflow-canvas` | error | 着墨超出画布 |
| `outside-safe` | warn | 文字超出安全区 |
| `text-overflow` | error | 文字超出了写死的宽度或高度 |
| `flex-overflow` | warn | 子元素超出了写死尺寸的 flex 容器 |
| `text-overlap` | warn | 两段文字的着墨区域重叠 |
| `min-font-size` | warn | 字号小于 `画布宽度 / 1080 × 24` |
| `auto-wrap` | info | 文字超出可用宽度，被自动换行 |
| `non-canonical` | info | 含义明确，但不是规范写法。照常渲染，`hint` 里是规范写法 |
| `unknown-tag` | warn | 不认识的标签 |
| `invalid-attr` | warn | 属性放错了位置，或两种写法混用。不认识的属性名不报，留给 `draw` |
| `invalid-child` | warn | 非法子元素：线条放进 flex 容器，或文字盒子里放了 `h1`–`h3`、`p`、`div` |

每条问题都可以带 `hint`，是可以直接照做的改法。

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

绘制顺序：先画该元素默认内容（文字、形状、线条、子节点），再调用 `draw`。`ctx` 原点在元素盒子的左上角，坐标范围 `(0,0)` 到 `(el.w, el.h)`，并且已经包含该元素和所有祖先 `Layer` 的 `rotate`、`scale`（绕各自的 `origin`）。线条的盒子是纯几何范围，所以水平线的 `el.h` 是 0。尺寸用 `el.w`、`el.h`，不要从 `el.attr` 推算。`opacity` 由外层统一乘到 `globalAlpha`。自定义属性原样出现在 `el.attr` 里。

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

`renderComposition` 对 `frame = 0 .. durationInFrames - 1` 调用 `component({ frame, fps, t: frame / fps })`，再 `renderFvg(node, { t })`。`fps` 必须大于 0，`durationInFrames` 为不小于 1 的整数。返回每一帧的 PNG 和布局报告（`frames`、`reports`），以及一张白色底的联系表：列数约为帧数的平方根，单元格按比例缩小、不放大，最长边不超过 480px，整张宽度不超过 3840px。

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

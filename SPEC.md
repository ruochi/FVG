# FVG 规范 v0.1（Flex Vector Graphics）

FVG 用标签描述**一帧画面**：图形用 SVG 的写法，文字用 HTML 的写法，布局用 CSS flexbox。
动画 = 程序为每个时刻生成一份 FVG（v0.2 起）。

设计原则：

1. **一律实际像素**：所有数字都是像素，可以写 `px` 后缀，不支持百分比、em、rem。
2. **中心点定位**：自由摆放时用 `cx`、`cy` 表示元素中心，所有元素都一样。
3. **y 轴向下**：和 Canvas、HTML 一致，`cy="400"` 表示距离父级顶部 400 像素。
4. **显式写了就照做**：写了尺寸、位置就严格使用，不会被悄悄改掉；有问题只在报告里指出。
5. **没写的由渲染器决定，并写进报告**：比如自动换行。
6. **一个值只有一个写法**：落在 Layer 坐标上的写成标签属性，其余全部写进 `style`（见第 3 节）。

## 1. 文件结构

```html
<fvg style="width:1080px; height:1920px; background:#0f1115; color:#ffffff">
  <font family="DeYiHei" src="https://example.com/deyihei.otf" />
  <Column cx="540" cy="700" style="gap:32px">
    <h1>比特币减半</h1>
    <p style="color:#f7931a">每四年一次</p>
  </Column>
</fvg>
```

根元素 `<fvg>` 本身就是一个 `Layer`（见下文），`style` 里可以写：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `width`、`height` | `1080`、`1920` | 画布尺寸 |
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
| 形状 | `Rect`、`Circle`、`Ellipse` |
| 线条 | `Line`、`Arrow`、`Polyline`、`Polygon`、`Path` |

- 容器和形状首字母大写，文字标签全部小写（和 HTML 一样）。
- 后写的元素画在上面。
- 不认识的标签会被忽略，并在报告里给出警告。

## 3. 属性和 style

分界只有一条：**要落在 Layer 坐标上的，写成标签属性；其余都写进 `style`。**

```html
<Layer style="width:148px; height:148px">
  <Circle style="r:70px; fill:#e23b2f; shadow:0 8px 16px #00000055" />
  <p style="font-size:36px; color:#fff">夜场</p>
</Layer>
<Line x1="72" y1="720" x2="1008" y2="720" style="stroke:#e4dbd0; stroke-width:2px" />
```

### 3.1 标签属性

| 属性 | 说明 |
| --- | --- |
| `id` | 报告里用来指认元素 |
| `cx`、`cy` | 在 `Layer` 里的定位点，默认是元素中心（见 `anchor`）；在 `Row`/`Column` 里无效 |
| `anchor` | 定位点在元素上的哪个位置，九宫格：`center`（默认）、`top`、`bottom`、`left`、`right`、`top-left`、`top-right`、`bottom-left`、`bottom-right` |
| `x1`、`y1`、`x2`、`y2`、`points`、`d` | 线条的 Layer 坐标，见第 7 节 |
| `style` | 其余所有属性 |

没写 `cx`、`cy` 时，默认放在父级 `Layer` 的中心。

`anchor` 示例：`<h1 cx="60" cy="120" anchor="top-left">` 表示标题左上角在 (60, 120)，也就是左对齐排版。

`<font family src>` 是字体声明，不是画面元素，照常写属性。

### 3.2 通用 style

所有画面元素都能写：

| 属性 | 说明 |
| --- | --- |
| `opacity` | 0 到 1，连同阴影和光晕一起变淡 |
| `rotate` | 绕元素中心旋转，单位度，顺时针为正；目前只对形状生效 |
| `scale` | 绕元素中心缩放；目前只对形状生效 |
| `shadow`、`glow` | 阴影和光晕，见第 8 节 |

`rotate`、`scale` 只影响绘制，不影响布局；报告里的盒子是变换前的。

### 3.3 旧写法

把 `style` 里的属性直接写在标签上（例如 `<Circle r="70" fill="#e23b2f">`）仍然能读，`style` 优先。报告会对每一项给出 `legacy-attr` 警告，提示改写进 `style`。

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
- 形状默认 `flex-shrink:0`，不会被压扁。

**可用宽度**：放在 Layer 里、没写 `width` 的 Row/Column，最宽只能到 Layer 的宽度（根 Layer 要减去左右安全区）。

## 5. 文字

最外层的文字标签是一个**文字盒子**，里面只能放文字和行内标签（`span`、`strong`、`b`、`em`、`br`）。
要排列多段文字，请用 `Row`/`Column`，不要在文字盒子里嵌套 `div`、`p`。

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

尺寸和上色都写进 `style`：

| 标签 | 尺寸 |
| --- | --- |
| `Rect` | `width`、`height`、`rx`（圆角） |
| `Circle` | `r` |
| `Ellipse` | `rx`、`ry` |

上色和 SVG 的 CSS 写法一致：`fill`（默认 `#000000`，写 `none` 不填充）、`stroke`（默认 `none`）、`stroke-width`（默认 1）、`stroke-dasharray`。

```html
<Circle cx="200" cy="200" style="r:80px; fill:none; stroke:#f7931a; stroke-width:12px" />
```

形状可以放在 Layer 里（用 `cx`、`cy` 定位），也可以放在 Row/Column 里参与排列。

## 7. 线条

坐标写成标签属性：

| 标签 | 坐标 |
| --- | --- |
| `Line`、`Arrow` | `x1`、`y1`、`x2`、`y2` |
| `Polyline`、`Polygon` | `points="x,y x,y …"` |
| `Path` | `d`（SVG 路径语法） |

```html
<Arrow x1="280" y1="200" x2="420" y2="200" style="stroke:#333; stroke-width:6px" />
```

- 线条只能放在 Layer 里，坐标是 **Layer 的局部坐标**（和 SVG 一样，不用 `cx`、`cy`）。
- `style` 里写 `stroke`（默认全局 `color`）、`stroke-width`（默认 4；注意和 SVG 不同，SVG 默认不描边，线条会看不见）、`stroke-linecap`、`stroke-linejoin`、`stroke-dasharray`。
- `Polygon`、`Path` 可以写 `fill`，默认 `none`。
- `Arrow` 可以写 `head`：箭头长度，默认 `stroke-width` 的 4 倍，最小 12。

## 8. 阴影和光晕

两者都写在 `style` 里，数字都是像素，只影响绘制，不影响布局。

```html
<Circle cx="720" cy="520" style="r:230px; fill:#f6f1e7; glow:48px #f6f1e7; shadow:0 18px 28px #00000055" />
```

| 写法 | 默认 | 说明 |
| --- | --- | --- |
| `shadow: x y [blur] [spread] [color]` | blur 0、spread 0、颜色 `#00000066` | 投影，顺序同 CSS `box-shadow` |
| `glow: blur [spread] [color]` | spread 0，颜色取本体 | 绕着本体散开的光，没有偏移 |

- `x`、`y` 是元素自己的方向，x 向右、y 向下，跟着元素的 `rotate`、`scale` 一起转。
- `blur` 是模糊半径，`spread` 是模糊前把剪影往外扩（负数往里缩）。
- 阴影跟着盒子走：文字和容器用外框（含 `border-radius`），形状用图形本身，线条用描边。
- 光晕跟着着墨走：文字用字形，形状用填充加描边，线条用描边，容器用外框。
- 光晕默认颜色：形状取 `fill`，没有填充就取 `stroke`；文字取字色；线条取 `stroke`；容器取 `background`，没有就取边框色。实际用了哪个颜色写进报告。
- 每个元素先画阴影，再画光晕，最后画本体。`opacity` 三层一起变淡。
- 要偏移的亮边，用带亮色的 `shadow`。

## 9. 布局报告

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
      "effect": { "...": "有阴影或光晕时才有：效果可能画到的范围，字段同 box" },
      "shadow": { "x": 0, "y": 8, "blur": 16, "spread": 0, "color": "#00000066" },
      "glow": { "blur": 24, "spread": 0, "color": "#ffffff" },
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
- `effect`：阴影剪影按偏移平移、光晕剪影原地，各自四边外扩 `spread + blur × 2`，再取并集。
- `shadow`、`glow`：补全默认值之后的实际取值。

检查项：

| code | 级别 | 含义 |
| --- | --- | --- |
| `overflow-canvas` | error | 着墨超出画布 |
| `effect-clipped` | warn | 本体在画布内，但阴影或光晕超出画布，边缘会被裁掉 |
| `outside-safe` | warn | 文字超出安全区 |
| `text-overflow` | error | 文字超出了写死的宽度或高度 |
| `flex-overflow` | warn | 子元素超出了写死尺寸的 Row/Column |
| `text-overlap` | warn | 两段文字的着墨区域重叠 |
| `min-font-size` | warn | 字号小于 `画布宽度 / 1080 × 24` |
| `auto-wrap` | info | 文字超出可用宽度，被自动换行 |
| `unknown-tag`、`invalid-attr` | warn | 不认识的标签，或无法解析的属性值 |
| `invalid-child` | warn | 非法子元素（如 `Line`/`Path` 放在 `Row`/`Column` 内） |
| `ignored-position` | warn | `Row`/`Column` 的子元素写了 `cx`、`cy` 或 `anchor`，这些不会生效 |
| `unused-style` | warn | `style` 里写了这类元素用不上的项 |
| `legacy-attr` | warn | 本该写进 `style` 的属性直接写在了标签上（仍然生效） |

## 10. 命令行

```bash
fvg render scene.fvg -o scene.png --report scene.json   # 渲染 PNG + 报告
fvg render scene.fvg --debug                             # 叠加画出盒子（蓝）和着墨范围（红）
fvg render scene.fvg --scale 0.5                         # 缩小输出，方便 AI 快速查看
fvg check scene.fvg                                      # 只输出检查结果，不出图
```

默认字体寒蝉端黑体首次使用时自动下载到 `~/.cache/fvg/fonts`。

## 11. 预留（后续版本）

- `draw` 钩子：任何元素都可以挂 JS 函数自定义绘制（`ctx`、`w`、`h`、测量工具）。
- `frame(t)`：每个时刻生成一份 FVG，导出视频和联系表。
- 墨迹布局：按着墨范围计算间距、居中、包裹。
- `Icon`、渐变、`Image`。
- 2.5D 与 3D：`rotateX`、`rotateY`、`z`、`perspective`、`Scene3D` 这些名字已保留，不要挪作他用。

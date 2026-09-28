# FVG 元素、属性和 style

标签全部小写。**落在 layer 坐标上的写标签属性，其余写 `style`。** 像素可写 `12` 或 `12px`。不支持百分比、`em`、`rem`。

不认识的标签会被忽略。`style` 里写了该元素用不上的项，报告记 `unused-style`。本该进 `style` 的值写在标签上仍能读，并记 `legacy-attr`。

布局和绘制的完整规则见 [SPEC.md](SPEC.md)。

## 分类

| 类别 | 标签 | 放在哪 |
| --- | --- | --- |
| 根 | `fvg` | 文件只有一个根，本身是一块画布，也是一个 `layer` |
| 字体 | `font` | 只能写在 `fvg` 下面，不占画面 |
| 自由容器 | `layer` | 子元素用 `cx`、`cy` 摆放 |
| 排列容器 | `row`、`column` | 子元素按 flex 排列，`cx`、`cy`、`anchor` 无效 |
| 文字盒子 | `h1`、`h2`、`h3`、`p`、`div`、`span` | 盒子里只能放文字和行内标签 |
| 行内 | `span`、`strong`、`b`、`em`、`br` | 写在文字盒子内部，不单独占一个布局盒 |
| 形状 | `rect`、`circle`、`ellipse` | `layer` 里定位，或放进 `row`、`column` |
| 线条 | `line`、`arrow`、`polyline`、`polygon`、`path` | 只能放在 `layer` 里，坐标写在属性上 |

后写的元素画在上面。

## 共用

### 标签属性

画面元素（除线条的几何属性外）在 `layer` 里用这些属性定位：

| 属性 | 说明 |
| --- | --- |
| `id` | 报告和 `fvg debug --focus` 用来指认 |
| `cx`、`cy` | 定位点，相对父级 `layer` 左上角。y 向下。没写时放在父级中心 |
| `anchor` | 定位点落在元素的哪一处。`center`（默认）、`top`、`bottom`、`left`、`right`、`top-left`、`top-right`、`bottom-left`、`bottom-right` |
| `style` | 下面各类的视觉和尺寸 |

`row`、`column` 的子元素写 `cx`、`cy`、`anchor` 不会生效，报告记 `ignored-position`。

### 效果 style

文字、容器、形状、线条都能写。只影响绘制，不改变布局盒子。

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `opacity` | `1` | 0 到 1，本体、阴影、光晕一起变淡 |
| `rotate` | `0` | 度，顺时针。绕元素中心。目前只对形状生效 |
| `scale` | `1` | 绕元素中心缩放。目前只对形状生效 |
| `shadow` | 无 | `x y [blur] [spread] [color]`。默认 blur 0、spread 0、颜色 `#00000066` |
| `glow` | 无 | `blur [spread] [color]`。默认 spread 0，颜色取本体 |

`shadow` 跟着盒子或图形，`glow` 跟着着墨。光晕按加光绘制。

### 在 row、column 里的子元素

父级是 `row` 或 `column` 时，子元素的 `style` 还可以写：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `flex-grow` | `0` | 分到多余空间 |
| `flex-shrink` | 文字 `1`，其他 `0` | 空间不够时缩小。文字会换行，但不会窄过最长的一个不可断开的词 |
| `align-self` | 继承 `align-items` | `start`、`center`、`end`、`stretch` |
| `flex` | 无 | 写成 `1` 时等于 `flex-grow:1; flex-shrink:1` |

## 根 `fvg`

`style`：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `width`、`height` | `1080`、`1920` | 画布像素 |
| `background` | `#ffffff` | `transparent` 输出透明 PNG |
| `color` | `#111111` | 默认文字色，也是线条默认 `stroke` |
| `font-family` | `ChillDuanSans` | 默认字体 |
| `safe` | 短边的 4% | `上 右 下 左`，或一个数表示四边。只用于检查，不裁切 |

## 字体 `font`

不是画面元素。属性：`family`、`src`（本地路径或网址）。

## `layer`

子元素用 `cx`、`cy`、`anchor`。写了 `width`、`height` 就用这个尺寸；没写则包住全部子元素。

`style`：`width`、`height`、`background`、`background-color`、`border`、`border-radius`，以及共用效果。

`border` 只支持实线，例如 `2px solid #fff`。

## `row`、`column`

`row` 横向，`column` 纵向。

`style`：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `width`、`height` | 包住内容 | 外框，含 padding 和 border |
| `gap` | `0` | 子元素间距 |
| `padding` | `0` | 1 到 4 个数，同 CSS |
| `align-items` | `center` | `start`、`center`、`end`、`stretch` |
| `justify-content` | `start` | `start`、`center`、`end`、`space-between`、`space-around`、`space-evenly` |
| `background`、`background-color`、`border`、`border-radius` | 无 | 同 `layer` |

另加共用效果。放在 `layer` 里又没写 `width` 时，最宽不超过该 layer 的内容宽（根上还要减去左右 `safe`）。

## 文字盒子

`h1`、`h2`、`h3`、`p`、`div`、`span` 各自是一个盒子。盒子内只放文字和行内标签。多段文字用 `row`、`column` 排，不要在盒子里再套 `div` 或 `p`。

默认字号和字重：

| 标签 | 字号 | 字重 |
| --- | --- | --- |
| `h1` | 88 | 700 |
| `h2` | 64 | 700 |
| `h3` | 48 | 700 |
| `p`、`div`、`span` | 40 | 400 |

`style`：

| 属性 | 说明 |
| --- | --- |
| `font-size`、`font-weight`、`font-family`、`color`、`letter-spacing` | 同 CSS。只有 `ChillDuanSans` 使用指定字重，其他字体按 400 测量和绘制 |
| `line-height` | 倍数。只拉开同一段里各行的距离。单行盒子贴着字形，不在上下加半行 |
| `text-align` | `left`（默认）、`center`、`right` |
| `width`、`height` | 外框，含 padding 和 border |
| `max-width` | 超过就换行，盒子贴着最长的一行 |
| `padding`、`background`、`background-color`、`border`、`border-radius` | 同 CSS |
| `white-space` | `nowrap` 禁止换行 |
| `text-wrap` | `balance`（默认，各行尽量一样长）或 `wrap`（尽量填满一行） |

另加共用效果。

换行：写了 `width` 按内容宽折行；只写 `max-width` 则超出才折；都没写时默认一行，超出可用宽度才自动折行，并在报告里记 `auto-wrap`。中文可在字间断开，英文单词和连续数字不拆。硬换行只用 `br`。

### 行内

`span`、`strong`、`b`、`em` 可以写 `font-size`、`font-weight`、`font-family`、`color`、`letter-spacing`。`strong` 和 `b` 默认字重 700。`br` 强制换行。

## 形状

| 标签 | 尺寸 style | 说明 |
| --- | --- | --- |
| `rect` | `width`、`height`、`rx` | `rx` 或 `border-radius` 是圆角 |
| `circle` | `r` | 盒子是直径 |
| `ellipse` | `rx`、`ry` | 盒子是两条直径 |

上色 style：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `fill` | `#000000` | `none` 不填 |
| `stroke` | `none` | |
| `stroke-width` | `1` | |
| `stroke-dasharray` | 无 | 同 SVG |

另加共用效果。定位用 `cx`、`cy`、`anchor`，或放进 `row`、`column`。

## 线条

坐标是父级 `layer` 的局部坐标，写在属性上，不用 `cx`、`cy`。放进 `row`、`column` 会记 `invalid-child` 并忽略。

| 标签 | 属性 | 说明 |
| --- | --- | --- |
| `line`、`arrow` | `x1`、`y1`、`x2`、`y2` | 线段两端 |
| `polyline`、`polygon` | `points` | `x,y x,y …` |
| `path` | `d` | SVG 路径 |

`style`：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `stroke` | 根上的 `color` | |
| `stroke-width` | `4` | 和 SVG 不同，线条默认有描边 |
| `stroke-linecap` | 无 | `butt`、`round`、`square` |
| `stroke-linejoin` | 无 | `miter`、`round`、`bevel` |
| `stroke-dasharray` | 无 | |
| `fill` | `none` | 仅 `polygon`、`path` |
| `head` | `stroke-width` 的 4 倍，至少 12 | 仅 `arrow`，箭头长度 |

另加共用效果。

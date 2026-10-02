# Flex Layer 规范 v0.1

Flex Layer 用标签描述**一帧画面**。HTML 标签用 `style`，其余标签用属性。结构标签只有 `Layer`。文字用 HTML 写法，排布用 `display:flex`，图形用 SVG 属性。
动画 = 程序为每个时刻生成一份 Flex Layer（v0.2 起）。

设计原则：

1. **一律实际像素**：所有数字都是像素，可以写 `px` 后缀，不支持百分比、em、rem。
2. **位置由 Layer 决定**：`Layer` 负责定位，`display:flex` 的 HTML 负责排布。图形用自身坐标画在 Layer 里。
3. **y 轴向下**：和 Canvas、HTML 一致，`cy="400"` 表示距离父级顶部 400 像素。
4. **显式写了就照做**：写了尺寸、位置就严格使用，不会被悄悄改掉；有问题只在报告里指出。
5. **没写的由渲染器决定，并写进报告**：比如自动换行。
6. **写错了要说怎么改**：有歧义或会被忽略的写法报 `warn` 并给出 `hint`；含义明确但不规范的写法照常渲染，报 `info`。不认识的属性名一律保留，给 `draw` 用。

给模型的硬性约定见 [AGENTS.md](AGENTS.md)。效果图见 [docs/GALLERY.md](docs/GALLERY.md)。

## 1. 文件结构

```html
<Layer width="1080" height="1920" background="#0f1115" color="#ffffff">
  <font family="DeYiHei" src="https://example.com/deyihei.otf" />
  <Layer cx="540" cy="700">
    <div style="display:flex; flex-direction:column; gap:32px; align-items:center">
      <h1>比特币减半</h1>
      <p style="color:#f7931a">每四年一次</p>
    </div>
  </Layer>
</Layer>
```

根元素 `<Layer>` 本身就是一个 `Layer`（见下文），属性：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `width`、`height` | 必填 | 画布尺寸 |
| `background` | `#ffffff` | 画布背景色，写 `transparent` 输出透明 PNG |
| `color` | `#111111` | 全局文字色、线条默认色 |
| `font-family` | `ChillDuanSans` | 全局字体。也可以写 `Song`（宋体）、`Kai`（楷体）、`Brush`（书法），第一次用到时自动下载 |
| `safe` | 画布短边的 4% | 安全区边距，`上 右 下 左` 或一个数字，只用于检查 |

`<font family="名字" src="路径或网址" />` 注册额外字体，只能写在根元素下。不想自己找字体文件时，直接写内置名字：`Song` / `宋体`（思源宋体）、`Kai` / `楷体`（霞鹜文楷）、`Brush` / `书法`（马善政毛笔楷书）。宋体和楷体有 regular 与 bold 两档，书法只有一档。

## 2. 元素一览

| 类别 | 标签 |
| --- | --- |
| 容器 | `Layer`（嵌套不填背景）。横排竖排用带 `display:flex` 的 `div` |
| 绘制 | `draw`（子标签，正文 JS；程序侧也可用 `draw={fn}`） |
| 文字 | `h1`、`h2`、`h3`、`p`、`div`、`span`；行内：`span`、`strong`、`b`、`em`、`br` |
| 图片 | `img`（`image` 是同一个标签） |
| 形状 | `Rect`、`Circle`、`Ellipse` |
| 线条 | `Line`、`Arrow`、`Polyline`、`Polygon`、`Path`、`Curve` |
| 复用 | `symbol`、`use` |

- `Layer` 和图形首字母大写，文字和图片标签全部小写（和 HTML 一样）。HTML 只写 `style`，`Layer` 和图形只写属性。图片的 `src`、`alt` 仍是属性。
- 后写的元素画在上面。
- 不认识的标签会被忽略，并在报告里给出警告。

## 3. 通用属性与归属

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

属性归属（由 [src/schema.ts](src/schema.ts) 生成，不要手改两行标记之间的表）：

<!-- attrs:ownership:begin -->
| 属性 | 写在哪 |
| --- | --- |
| `width`、`height`、`opacity`、`rotate`、`scale`、`origin`、`cx`、`cy`、`anchor` | `Layer` 的属性。HTML 上写了报 `warn` |
| `background`、`padding`、`font-size`、`color`、`flex`、`flex-grow`、`flex-shrink`、`gap`、`border`、`border-radius`、`max-width`、`align-items`、`justify-content`、`writing-mode`、`object-fit`、`object-position` | HTML 的 `style`。`Layer` 或图形写了 `style` 报 `warn` |
| `x1`、`y1`、`x2`、`y2`、`points`、`d`、`fill`、`stroke` | 图形属性，坐标是所在 `Layer` 的局部坐标 |
| `src`、`alt` | 只写在 `img` 上。宽高仍放进 `style` |
| `shadow`、`glow`、`inner-shadow`、`inner-glow`、`blur`、`backdrop-blur`、`glass`、`noise`、`filter`、`blend` | 图形和 `Layer` 写属性；文字写在 `style`。见第 9 章 |
| `overlay`、`grade`、`grade-mask` | 只写在 `Layer` 上。写在别处或写进 `style` 报 `warn` |
<!-- attrs:ownership:end -->

叶子的定位：

| 叶子 | 怎么定位 |
| --- | --- |
| 文字，以及没写宽高的一组 HTML | 外包一层 `Layer`，把 `cx`、`cy`、`anchor` 写在 `Layer` 上 |
| 图片 `img` | 和文字一样，外包一层 `Layer` 来定位 |
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

`border`、`border-radius`、`overflow` 写在 `Layer` 的属性上，不写 `style`。**`Layer` 不填背景**：它只合成子元素画出来的内容。色块用 `Rect` 的 `fill`、HTML 的 `style="background: …"`，或子标签 `<draw>` 自己画。`Layer` / `use` 上写 `background` 会警告并忽略。画布底色只写在根节点 `<Layer background>`。

一组 HTML 要放到画面上，包一层 `Layer`，把 `cx`、`cy`、`anchor` 写在 `Layer` 上。

`symbol` 定义一块可复用的图，本身不画出来。`use` 按 Layer 的方式摆放它：`cx`、`cy`、`anchor`、`rotate`、`scale`、`opacity` 都写在 `use` 上。`symbol` 里的坐标是它自己的局部坐标。

```html
<symbol id="dew" width="28" height="28">
  <Circle cx="14" cy="14" r="12" fill="radial-gradient(#ffffff, #ffffff00)" />
</symbol>
<use href="#dew" cx="180" cy="640" />
<use href="#dew" cx="240" cy="700" scale="0.8" />
```

没写 `width`、`height` 时，`symbol` 的盒子包住内容。`href` 写成 `#id`。

```html
<Layer cx="120" cy="64" anchor="top-left">
  <div style="display:flex; gap:40px; align-items:center">
    <h2 style="font-size:56px">勾股定理</h2>
  </div>
</Layer>
```

### 4.2 flex：HTML 排布

`display:flex` 把 `div`（以及其他文字标签）变成排布容器，不再当文字盒子。默认横向。竖排写 `flex-direction:column`。子元素是文字、图片、flex 容器或 `Layer`。

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
- 形状和图片默认 `flex-shrink:0`，不会被压扁。

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
| （字重规则） | `ChillDuanSans` 按可变字重。`Song`、`Kai` 在 400 和 700 两档里取最近的一档。`Brush` 和其它只注册了一个文件的字体按 400 |
| `writing-mode` | `horizontal-tb`（默认）或 `vertical-rl`。竖排时字从上到下，列从右到左，`letter-spacing` 是字与字之间的额外间距 |
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
6. 硬换行只用 `<br>`。源码里的换行和连续空格折成一个空格，每一行的行首行尾空格去掉。行内标签交界处的空格保留，`A <span>B</span> C` 是 `A B C`。`&nbsp;` 不折叠，也不当行首行尾空格去掉。

## 6. 图片

`img` 是 HTML 标签，不是图形。`image` 和 `img` 是同一个标签。尺寸、圆角、透明度和效果写在 `style` 里；`src` 和 `alt` 写属性。

```html
<img src="cover.png" alt="封面" style="width:320px; height:180px; object-fit:cover; border-radius:16px" />
```

| 项 | 说明 |
| --- | --- |
| `src` | 必填属性。相对路径相对 `.layer` 所在目录，也支持 `http(s)` 和 data URL |
| `alt` | 属性，不绘制 |
| `width`、`height` | 外框尺寸，含 padding 和 border。都没写时用图片像素尺寸；只写一边时另一边按原比例 |
| `object-fit` | `fill`（默认，拉伸铺满）、`contain`（整张放进盒子）、`cover`（铺满并裁切）、`none`（原始像素，不缩放） |
| `object-position` | 默认 `center`。可写 `top`、`left`、`top-left`、`left top`，或相对图片盒子的 `0%`–`100%`（例如 `50% 0%`） |
| `border-radius`、`opacity`、`padding`、`background`、`border` | 同其它 HTML。圆角会裁切图片 |

图片可以放进 `display:flex`，默认不缩小。在 Layer 里和文字一样默认居中；要指定位置就外包一层 `Layer`，把 `cx`、`cy`、`anchor` 写在那一层上。加载失败报 `missing-image`，写了宽高的盒子仍然占位。缺 `src` 报 `invalid-attr`。

## 7. 形状与线条

### 7.1 形状

两种写法只能选一种。两点可以反着写，取最小最大。`Circle` 只有中心写法。

| 标签 | 中心写法 | 两点写法 |
| --- | --- | --- |
| `Rect` | `cx` `cy` `width` `height`，另有 `rx`（圆角） | `x1` `y1` `x2` `y2`，对角两个角 |
| `Ellipse` | `cx` `cy` `rx` `ry` | `x1` `y1` `x2` `y2`，外接矩形的对角 |
| `Circle` | `cx` `cy` `r` | 不支持 |

`Rect` 写 SVG 的 `x` `y` `width` `height` 时，按左上角渲染，并报 `info`。形状上写 `anchor` 也照做，并报 `info`。

绘制属性和 SVG 一致：`fill`（默认 `#000000`，写 `none` 不填充）、`stroke`（默认 `none`）、`stroke-width`（默认 1）、`stroke-dasharray`。

### 7.2 线条

| 标签 | 属性 |
| --- | --- |
| `Line` | `x1`、`y1`、`x2`、`y2` |
| `Arrow` | `x1`、`y1`、`x2`、`y2`、`head`（箭头长度，默认 `stroke-width` 的 4 倍，最小 12） |
| `Polyline`、`Polygon` | `points="x,y x,y …"` |
| `Path` | `d`（SVG 路径语法） |
| `Curve` | `points="x,y x,y …"`，可选 `closed` |

- 线条只能放在 Layer 里，坐标是 **Layer 的局部坐标**（和 SVG 一样，不用 `cx`、`cy`）。写了 `cx`、`cy` 会忽略并报 `warn`。
- 布局盒子是纯几何范围，水平线的高度可以是 0。描边和箭头只算进报告的 `ink`。
- `stroke` 默认是全局 `color`，`stroke-width` 默认 4（注意和 SVG 不同：SVG 默认不描边，线条会看不见）。
- `Polygon`、`Path`、`Curve` 的 `fill` 默认 `none`。开口的 `Curve` 写了 `fill` 也不填，并给出警告；要色块就加 `closed`。
- `Curve` 穿过 `points` 里的每个点，绘制时转成贝塞尔。两个点退化为直线。
- 还支持 `stroke-linecap`、`stroke-linejoin`、`stroke-dasharray`。

## 8. 填充 paint

`fill`、`stroke`、画布 `background`、HTML 的 `background`，以及第 9 章里的 `overlay`、`grade-mask`，共用这一套写法。色标位置是元素自己的 0 到 1，也可以写百分比，不是布局用的百分比。文字的 `color` 仍是纯色。

```html
<Rect x="0" y="0" width="720" height="960" fill="linear-gradient(to bottom, #0c1424, #1a3352 55%, #6e7c72)" />
<Circle cx="520" cy="220" r="70" fill="radial-gradient(at 40% 35%, #fff, #f4efe4 40%, #d9d0c0)" />
```

`linear-gradient` 默认从上到下，可以写 `to top`、`to right` 或 `180deg`。`radial-gradient` 默认从中心散开，`at 40% 35%` 把高光挪到左上。

`gradient()` 是同一类填充的另一种写法，能画线性、径向、锥形和矩阵渐变。颜色是一张矩阵：列沿参数 `u`，行沿参数 `v`，行与行用 `/` 分开。像素先映射成 `(u, v)`，再在 OKLab 里做双线性插值（透明按预乘）。超出 0 到 1 的部分钳制在两端。只有一行时忽略 `v`。

```
gradient( [映射 ,] 颜色行 [ / 颜色行 ]* )
颜色行 = 颜色 [位置] [, 颜色 [位置]]*
```

位置是 0 到 1，不是像素。省略时第一个是 0，最后一个是 1，中间均匀排开。坐标是元素盒子里的像素，原点在这个盒子的左上角，y 向下，跟元素放在图层的哪里无关。颜色可以是 `#rgb`、`#rgba`、`#rrggbb`、`#rrggbbaa`、`rgb()`、`rgba()`、`transparent`。

| 映射 | u | v |
| --- | --- | --- |
| 省略，或 `box` | 从左到右 | 从上到下 |
| `linear x1 y1 x2 y2` | 线段起点到终点 | 线段的左手侧，距离按线段长度计；第一行贴在线段上 |
| `radial cx cy r` | 圆心到半径 `r` | 从正上方起顺时针一圈 |
| `radial cx cy r0 r1` | 内半径到外半径 | 同上 |
| `conic cx cy [角度]` | 从正上方起、再加起始角度，顺时针一圈 | 圆心到盒子最远角 |

```html
<Rect cx="200" cy="120" width="400" height="240" fill="gradient(#0f1115, #f7931a)" />
<Rect cx="200" cy="120" width="400" height="240" fill="gradient(#0f1115 / #f7931a)" />
<Rect cx="200" cy="120" width="400" height="240" fill="gradient(#ff0000 #00ff00 / #0000ff #ffffff)" />
<Circle cx="400" cy="500" r="120" fill="gradient(radial 120 120 120, #ffffff, #f7931a 0.45, #0f1115)" />
<Rect cx="540" cy="700" width="400" height="400" fill="gradient(conic 200 200, #ff0000, #00ff00, #0000ff, #ff0000)" />
```

锥形的 `u`、径向的 `v` 走到 1 就回到起点。要无缝接上，把第一个颜色或第一行在末尾再写一次。铺满整个盒子用矩阵；多行的 `linear` 只向线段左侧展开。盒子在某个方向上长度为 0 时（比如水平线没有高度），这一维没有变化：沿竖线变色写成两行，不要写成一行。

语法解析失败时报 `invalid-attr`，并退回该属性的默认纯色。线条上的渐变坐标相对线条的几何外框。

## 9. 效果

图形和 `Layer` 把效果写在属性上。文字把同一项写在 `style` 里。**作用于整棵子树的效果只写在 `Layer` 上**：`overlay`、`grade`、`grade-mask`。写在图形、文字或 `style` 里报 `invalid-attr` 并忽略。

效果只影响绘制，不改变布局盒子。**一律按着墨（墨迹 / alpha）计算，不按布局盒子**：文字跟字形，形状跟几何填充，Layer / flex 跟自身边框或背景；`blur` / `filter` / `blend` 作用在已绘制像素上。

绘制顺序只此一份：`backdrop-blur` / `glass` 取样 → `shadow` → `glow` → 本体 → `inner-shadow` → `inner-glow` → `overlay` → `noise`。若有 `blur`、`filter` 或 `grade`，阴影到 overlay 先画进离屏，依次做 `grade`、`blur` / `filter`，贴回后再叠 `noise`（写了 `grade` 时颗粒不被染色）。同时写了 `blur` 与 `filter` 时，图层模糊以 `blur` 为准，并报 `info`。`glass` 与 `backdrop-blur` 同时出现时以 `glass` 为准，并报 `info`。

每个效果都按同一套字段描述：归属、语法、是否复用 paint、作用范围、在上面这条顺序里的位置、报告与问题码、图格。实现取舍见 [docs/EFFECTS.md](docs/EFFECTS.md)。图在 [docs/GALLERY.md](docs/GALLERY.md)。

不要占用这些名字：`outer-glow`、`drop-shadow`、`backdrop-filter`、`texture`。`filter` 里不要写 `blur()` / `drop-shadow()`。

### 9.1 投影发光

`shadow`、`glow`、`inner-shadow`、`inner-glow` 共用一套长度语法。外发光没有偏移。

| 属性 | 语法 | 默认 | 位置 |
| --- | --- | --- | --- |
| `shadow` | `x y [blur] [spread] [color]` | blur 0、spread 0、颜色 `#00000066` | 本体之前，外扩 |
| `glow` | `blur [spread] [color]` | 颜色取本体，按加光（screen）绘制 | 本体之前，外扩 |
| `inner-shadow` | 同 `shadow` | 同 shadow | 本体之后，不外扩 |
| `inner-glow` | 同 `glow` | 同 glow | 本体之后，不外扩 |

| 项 | 说明 |
| --- | --- |
| 归属 | 图形、线条、`Layer` 写属性；文字写 `style` |
| paint | 颜色是一个色值，不是渐变 |
| 作用范围 | 该元素的墨迹 |
| 报告 | 可能占用的范围在 `effect`；超出画布报 `effect-clipped` |
| 图 | [docs/gallery/shadow-glow.png](docs/gallery/shadow-glow.png) |

### 9.2 模糊与透视

| 想要 | 写 |
| --- | --- |
| 糊掉这个元素自己 | `blur` |
| 后面的画面变糊，本体半透明盖在上面 | `backdrop-blur` |
| 边缘折射的玻璃，中心不变形 | `glass`。`clear` 完全不糊，`thick` 才是毛玻璃 |

| 属性 | 语法 | 说明 |
| --- | --- | --- |
| `blur` | 单个非负像素 | 图层模糊：糊本元素（含 Layer 子树）已绘制像素；外扩计入 `effect-clipped` |
| `backdrop-blur` | 单个非负像素 | 背景模糊：糊元素背后已画内容，再透过半透明本体看见 |
| `glass` | 见下 | 边缘凸弧面透镜折射 + 色散 + 朝光高光。与 `backdrop-blur` 同时写时以 `glass` 为准 |

`glass` 有两种写法，都有效：

- 空格：`clear` / `regular` / `thick`，后可跟模糊像素与色调，如 `clear #a8c8ff20`、`regular 8 #ffffff22`、`0`。
- 逗号（和 `grade` 同一套：预设在前，后面按名字覆盖）：`clear, blur 8, tint #fff2`。可覆盖的名字还有 `refraction`、`specular`、`bezel`、`dispersion`。

三档预设：`clear` 模糊 0（背景完全清晰，只有折射）、`regular` 模糊 6、`thick` 模糊 36（毛玻璃）。折射只发生在墨迹边缘的弧面带（宽约短边 24%，最多 64px）：背景向内取样、在边缘被放大弯折，中心平坦区原样透出。glass 的投影不会透过玻璃被看到。

| 项 | 说明 |
| --- | --- |
| 归属 | 图形和 `Layer` 写属性；文字写 `style` |
| paint | `glass` 的色调是一个色值 |
| 作用范围 | `blur` 作用于已绘制像素；`backdrop-blur` / `glass` 取样背后的画面，再按墨迹贴回 |
| 图 | [docs/gallery/blur-glass.png](docs/gallery/blur-glass.png)、[docs/gallery/glass-scene.png](docs/gallery/glass-scene.png) |

### 9.3 调色

| 想要 | 写 |
| --- | --- |
| 整块提亮、去色、偏色相 | `filter` |
| 胶片风格：暗部高光分色、发灰、暗角 | `Layer` 的 `grade`，局部再加 `grade-mask` |
| 在画面上罩一层纯色或渐变 | `Layer` 的 `overlay` |

#### filter

| 项 | 说明 |
| --- | --- |
| 归属 | 图形和 `Layer` 写属性；文字写 `style` |
| 语法 | `brightness()`、`contrast()`、`saturate()`、`grayscale()`、`sepia()`、`invert()`、`hue-rotate()`，空格分隔。比例写 `0–1` 或百分比；`hue-rotate` 用度（`15` 或 `15deg`） |
| paint | 否 |
| 作用范围 | 已绘制像素 |
| 位置 | 离屏里，在 `grade` 之后，和 `blur` 一起 |
| 图 | [docs/gallery/color.png](docs/gallery/color.png) |

#### grade 与 grade-mask

`grade` 只写在 `Layer` 上，作用于整个子树：文字、图片、色块一起调。图片要调色就外包一层 `Layer`。根 `Layer` 写 `grade` 时连画布底色一起调。

```html
<Layer grade="lomo 0.8, fade 0.1" grade-mask="radial-gradient(#fff0 30%, #fff)">
  <img src="street.png" style="width:640px; height:800px; object-fit:cover" />
</Layer>
```

`grade` 是逗号分开的几项。第一项可以是预设名，后面可跟整体强度 0–1（和原图混合）。后面的项覆盖预设里的同名参数，没写的参数保持预设值。

| 参数 | 写法 | 默认 | 说明 |
| --- | --- | --- | --- |
| `shadows` | `<颜色> [强度]` | 不染色 | 暗部颜色。只取颜色的色相和浓淡，不改亮度。强度 0–1，默认 1 |
| `midtones` | 同上 | 不染色 | 中间调颜色 |
| `highlights` | 同上 | 不染色 | 高光颜色 |
| `contrast` | `0`–`2` | `1` | 大于 1 更硬，小于 1 更软 |
| `fade` | `0`–`1` | `0` | 抬高黑位，胶片的发灰感 |
| `saturate` | `0`–`2` | `1` | `0` 是黑白 |
| `warmth` | `-1`–`1` | `0` | 正数偏暖，负数偏冷 |
| `vignette` | `<0–1> [颜色]` | `0` | 四角压向该颜色，默认黑色 |

| 预设 | 效果 | 展开后 |
| --- | --- | --- |
| `lomo` | 暗部青、高光暖、四角压暗 | `shadows #1f5a6e 0.8, highlights #ffd59a 0.6, contrast 1.2, saturate 1.15, vignette 0.55` |
| `matte` | 哑光、黑位发灰 | `highlights #fff0d8 0.3, contrast 0.9, fade 0.35, saturate 0.85` |
| `chrome` | 青橙 | `shadows #1a6a7a 0.8, highlights #ffb070 0.7, contrast 1.1, saturate 1.1` |
| `bleach` | 低饱和高对比 | `contrast 1.25, fade 0.05, saturate 0.55` |
| `mono` | 黑白 | `contrast 1.1, saturate 0` |

计算在 OKLab 里进行，顺序是：`contrast` → `fade` → `saturate` → `warmth` → 三段染色 → `vignette` → 按强度和原图混合。染色排在 `saturate` 之后，所以 `mono, shadows #1f5a6e 0.4` 是冷调黑白。暗角的中心和遮罩都按这个 Layer 的盒子计算，和渐变的坐标一样。

`grade-mask` 复用第 8 章的 paint：纯色、`linear-gradient`、`radial-gradient` 或 `gradient()`。alpha 是强度：不透明处满强度，透明处保持原图。只写 `grade-mask` 不写 `grade` 时报 `warn`。

不同区域用不同效果：内外两层 `Layer` 各写一个 `grade`，各自用遮罩只盖自己那一块。

```html
<Layer grade="mono" grade-mask="linear-gradient(to right, #fff0 50%, #fff 50%)">
  <Layer grade="lomo" grade-mask="linear-gradient(to right, #fff 50%, #fff0 50%)">
    <img src="street.png" style="width:640px; height:400px" />
  </Layer>
</Layer>
```

| 项 | 说明 |
| --- | --- |
| 归属 | 只写在 `Layer` 的属性上 |
| paint | `grade-mask` 复用 paint |
| 作用范围 | 该 Layer 整棵子树的已绘制像素 |
| 位置 | 离屏里、`blur` / `filter` 之前 |
| 报告 | `grade` 回显预设展开后的完整参数 |
| 图 | [docs/gallery/color.png](docs/gallery/color.png) |

#### overlay

| 项 | 说明 |
| --- | --- |
| 归属 | 只写在 `Layer` 上 |
| 语法 | `<paint> [opacity] [blend]`。opacity 为 `0–1` 或百分比，与混合模式顺序可互换 |
| paint | 复用第 8 章 |
| 作用范围 | 按该 Layer 子树墨迹裁切 |
| 位置 | 内发光之后、噪点之前 |
| 图 | [docs/gallery/color.png](docs/gallery/color.png) |

示例：`overlay="#00000066"`、`overlay="#ff8800 0.4 multiply"`、`overlay="linear-gradient(to bottom, #ffffff00, #00000088) soft-light"`。

`blend` 的取值见 9.4，`overlay` 使用同一集合。

### 9.4 合成与质感

| 属性 | 语法 | 说明 |
| --- | --- | --- |
| `blend` | 见下 | 本元素整段绘制与背后的混合模式 |
| `noise` | `强度` 或 `强度 颜色` | 噪点，强度 0 到 1，叠在本体上。绘制顺序的最后一步 |

`blend` 取值：`source-over`（默认）、`multiply`、`screen`、`overlay`、`soft-light`、`lighten`、`darken`。

| 项 | 说明 |
| --- | --- |
| 归属 | 图形和 `Layer` 写属性；文字写 `style` |
| paint | `noise` 的颜色是一个色值 |
| 作用范围 | 已绘制像素 / 该元素墨迹 |
| 图 | [docs/gallery/shadow-glow.png](docs/gallery/shadow-glow.png) 里的 noise、blend 格 |

## 10. 报告与问题码

渲染时同时输出一份 JSON 报告：

```json
{
  "flexlayer": "0.1",
  "width": 1080,
  "height": 1920,
  "elements": [
    {
      "path": "Layer/Layer[0]/div[0]/h1[0]",
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
    { "level": "warn", "code": "invalid-child", "path": "Layer/div[0]/Line[0]", "message": "线条不能放在 flex 容器内", "hint": "包一层 Layer，例如 <Layer><Line …/></Layer>" }
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
| `invalid-child` | warn | 非法子元素：线条放进 flex 容器，文字盒子里放了 `h1`–`h3`、`p`、`div` 或图片 |
| `invalid-draw` | error / warn | `<draw>` 语法错误（error）或内容为空（warn） |
| `missing-image` | warn | `img` 的 `src` 读不到 |
| `missing-symbol` | warn | `use` 的 `href` 没有对应的 `symbol` |
| `symbol-cycle` | warn | `symbol` 通过 `use` 引用了自己 |
| `open-curve-fill` | warn | 开口的 `Curve` 写了 `fill`，没有填充 |
| `effect-clipped` | warn | 本体在画布内，阴影、光晕或图层模糊超出画布 |

每条问题都可以带 `hint`，是可以直接照做的改法。

## 11. 命令行

```bash
flexlayer render scene.layer -o scene.png --report scene.json   # 渲染 PNG + 报告
flexlayer render scene.layer --debug                             # 叠加画出盒子（蓝）和着墨范围（红）
flexlayer render scene.layer --scale 0.5                         # 缩小输出，方便 AI 快速查看
flexlayer check scene.layer                                      # 只输出检查结果，不出图
```

默认字体寒蝉端黑体首次使用时自动下载到 `~/.cache/flexlayer/fonts`。

## 12. 自定义绘制 draw

程序调用（React / Vue JSX 或 `h()`）时，任意元素可挂 `draw={(ctx, el) => { ... }}`。

在 `.layer` 文件里用子标签 `<draw>…</draw>`，正文是 JavaScript，可用变量只有 `ctx` 与 `el`（与回调参数相同）。`<draw>` 不参与布局，画在父元素默认内容之后；同一个元素只能有一个 `<draw>`。程序侧已挂 `draw` 回调时，忽略标签并警告。

```html
<Layer width="200" height="120" cx="100" cy="60">
  <draw>
    ctx.fillStyle = '#3ecfc4'
    ctx.fillRect(0, 0, el.w, el.h)
    ctx.strokeStyle = el.computed.color
    ctx.strokeRect(4, 4, el.w - 8, el.h - 8)
  </draw>
</Layer>
```

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
import { h, renderLayer } from '@dc/flexlayer'

const root = h('Layer', { width: '1080', height: '1920', background: '#0f1115', color: '#ffffff' },
  h('Layer', { cx: '540', cy: '700', anchor: 'center' },
    h('h1', {
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
  ),
)

await renderLayer(root)
```

JSX 可将 `jsxImportSource` 设为 `@dc/flexlayer`，使用 `@dc/flexlayer/jsx-runtime`。

带 `draw` 且写了尺寸的自定义元素，定位和形状相同。根节点 `<Layer>` 的 `draw` / `<draw>` 和其它元素一样，在画布底色和子元素画完之后执行。`el.w`、`el.h` 是画布尺寸，`el.t` 是当前秒数。`opacity`、`rotate`、`scale` 作用到整幅画面。

## 13. 帧序列

动画由程序按时间生成一棵 Flex Layer 节点，再交给渲染器。`t` 的单位是秒。单帧 `renderLayer` 不传 `t` 时，`el.t` 为 `0`。

```ts
import { h, renderComposition, type Composition } from '@dc/flexlayer'

const scene: Composition = {
  id: 'halving',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 90,
  component: ({ frame, fps, t }) =>
    h('Layer', { width: '1080', height: '1920', background: '#0f1115' },
      h('Layer', { cy: String(700 + Math.sin(t) * 40) },
        h('h1', {}, '比特币减半'),
      ),
    ),
}

const { frames, contactSheet } = await renderComposition(scene)
```

`renderComposition` 对 `frame = 0 .. durationInFrames - 1` 调用 `component({ frame, fps, t: frame / fps })`，再 `renderLayer(node, { t })`。`fps` 必须大于 0，`durationInFrames` 为不小于 1 的整数。返回每一帧的 PNG 和布局报告（`frames`、`reports`），以及一张白色底的联系表：列数约为帧数的平方根，单元格按比例缩小、不放大，最长边不超过 480px，整张宽度不超过 3840px。

随时间变化的位置、尺寸和文字写在 `component` 里，布局每一帧重新计算。`draw` 里用 `el.t` 读取同一个秒数。

三个纯函数不绘制画面：

| 函数 | 作用 |
| --- | --- |
| `interpolate(value, inputRange, outputRange)` | 线性映射，默认超出区间时钳制 |
| `spring({ frame, fps })` | 阻尼弹簧，从 0 趋近 1。`frame` 为 0 时是 0 |
| `sequence(input, { from, durationInFrames }, render)` | 当前帧落在区间内时，把减去 `from` 的局部 `frame` 和 `t` 交给 `render`；否则返回 `null` |

同一 `frame` 调用两次，得到同一张 PNG。命令行仍只渲染 `.layer` 文件。

## 14. 预留

- 把帧序列编码成视频，以及时间轴预览。
- 墨迹布局：按着墨范围计算间距、居中、包裹。
- `Icon`。
- 2.5D 与 3D：`rotateX`、`rotateY`、`z`、`perspective`、`Scene3D` 这些名字已保留，不要挪作他用。
- 滤镜设计说明见 [docs/EFFECTS.md](docs/EFFECTS.md)。勿占用：`outer-glow`、`drop-shadow`、`backdrop-filter`、`texture`。

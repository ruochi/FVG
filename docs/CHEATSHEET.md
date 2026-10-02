# Flex Layer 速查

HTML 用 `style`，其余标签用属性。数字都是像素，y 轴向下。根元素 `<layer width height>` 就是一个 layer。

## 结构

| 标签 | 做什么 |
| --- | --- |
| `layer` | 根画布兼定位容器。根上写 `width` `height` `background`（画布底色）`color` `safe`；定位用 `cx` `cy` `anchor`，还有 `opacity` `rotate` `scale` `origin`。可嵌套。**嵌套 layer 不填背景**。纯色/渐变叠加用 `overlay`（仅 layer） |
| `draw` | 子标签。正文是 JS（`ctx`、`el`），画在父元素内容之后。程序侧也可用 `draw={fn}` |
| `div` 写 `display:flex` | 排布。默认横向；竖排加 `flex-direction:column`。`gap` `align-items` `justify-content` `padding` `flex` 都在 `style` 里 |

要定位一组 HTML，包一层 `layer`，把 `cx` `cy` `anchor` 写在 `layer` 上。

## 叶子怎么定位

| 叶子 | 在 layer 里 | 在 flex 里 |
| --- | --- | --- |
| 文字 `h1` `h2` `h3` `p` `div` `span` | 外包 `layer` 来定位。文字本身只写 `style` | 直接放 |
| 图片 `img`（`image` 相同） | 外包 `layer` 来定位。`src` 是属性，宽高和 `object-fit` 写 `style` | 直接放，默认不缩小 |
| `rect` | `cx cy width height`，或 `x1 y1 x2 y2`（对角，可反着写） | 不规范。包一层有宽高的 layer，或改用 div |
| `ellipse` | `cx cy rx ry`，或两点写法表示外接矩形 | 同上 |
| `circle` | `cx cy r`（圆心） | 同上 |
| `line` `arrow` `polyline` `polygon` `path` `curve` | `x1 y1 x2 y2` / `points` / `d`，就是局部坐标。`curve` 用 `points`，闭合加 `closed` | 不渲染。包一层 `<layer>` |
| `symbol` / `use` | `symbol` 不画。`use href="#id"` 用 `cx cy` 摆放，可加 `rotate` `scale` | `use` 按它的宽高排进去 |
| `mask` | 只作为 `layer` 的直接子元素。里面写 `rect` `circle` `ellipse` `polygon` `path` 或 `img`。省略 `fill` 为 `#fff`，只看 alpha | 不排进去，会 `warn` |

形状和自定义元素不用 `anchor`，也不写 `style`。色块、圆点、分隔线用 div：`<div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4">`，分隔线用 `flex:1; height:4px`。

`fill` 可以写 `linear-gradient(to bottom, #0c1424, #6e7c72)`、`radial-gradient(at 40% 35%, #fff, #fff0)`，或 `gradient(#000, #fff)`、`gradient(#f00 #0f0 / #00f #fff)`。效果：`shadow` / `inner-shadow`（`0 8 16 #00000055`）、`glow` / `inner-glow`（`56 #f3ead4`）、`blur` / `backdrop-blur`（单个像素）、`glass="clear"`（零模糊边缘折射玻璃；`thick` 为毛玻璃）、`noise="0.08"`、`filter="saturate(1.1)"`、`blend="multiply"`。**仅 layer**：`overlay="#00000066"` / `overlay="#ff8800 0.4 multiply"` / `overlay="linear-gradient(to bottom, #fff0, #0008) soft-light"`。图形写属性，文字写在 `style` 里。

调色只写在 `layer` 上：`<layer grade="lomo 0.8, fade 0.1">`。参数有 `shadows #色 [强度]`、`highlights #色 [强度]`、`contrast`、`fade`、`saturate`、`warmth`、`vignette`；预设有 `lomo`、`matte`、`chrome`、`bleach`、`mono`。只想调某一块就加 `grade-mask="radial-gradient(#fff0 30%, #fff)"`，alpha 是强度。图片要调色就外包 `layer`。

整层裁切用 `<mask>`，和内容并列写在 `layer` 里：`<mask><circle cx="160" cy="90" r="90" /></mask>`。实心是硬边，`fill="linear-gradient(to bottom, #fff, #fff0)"` 是软边。`overflow="hidden"` 只裁子元素，不管阴影。

竖排：`style="writing-mode:vertical-rl"`。字体名 `Song`、`Kai`、`Brush` 不用自带字体文件。

## 属性归属

HTML 的字号、颜色、背景、间距、透明度、旋转都写在 `style` 里。图片也是 HTML：`<img src="cover.png" style="width:320px; height:180px; object-fit:cover" />`，`src` 留在属性上。图形的填充写成 `fill`。`layer` 不填背景：色块用 `rect`、`div`，或 `<draw>`。不认识的属性会保留给 `draw`。

## 报告

`warn` 表示写错了位置或会被忽略，`info` 的 `non-canonical` 表示照常渲染但不是规范写法。每条都有 `hint`。常见改法：

- 线条或两点坐标放进了 flex：包 `<layer width height>`。
- 文字上写了 `cx`：改成 `<layer cx cy anchor><p style="…">…</p></layer>`。
- 文字盒子里放了 `h3`、`p`：改成 `<div style="display:flex; flex-direction:column">`。

## 例子

```html
<layer width="800" height="400" background="#0e1219" color="#f4f1ea">
  <layer cx="40" cy="40" anchor="top-left">
    <div style="display:flex; gap:16px; align-items:center">
      <div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4"></div>
      <p style="font-size:40px">a² = 9</p>
    </div>
  </layer>
  <layer cx="400" cy="220" width="360" height="200">
    <rect x1="0" y1="0" x2="160" y2="120" fill="#3ecfc4" />
    <circle cx="200" cy="60" r="16" fill="#f4f1ea" />
    <line x1="160" y1="60" x2="184" y2="60" stroke="#f4f1ea" stroke-width="4" />
  </layer>
  <!-- 嵌套 layer 不写 background；要自己画用 draw -->
  <layer width="120" height="80" cx="640" cy="300">
    <draw>
      ctx.fillStyle = '#f5c16c'
      ctx.fillRect(0, 0, el.w, el.h)
    </draw>
  </layer>
</layer>
```

```html
<layer width="800" height="200" background="#0e1219" color="#f4f1ea">
  <layer cx="40" cy="80" anchor="top-left">
    <div style="display:flex; width:720px; gap:16px; align-items:center">
      <p style="font-size:40px">左</p>
      <div style="flex:1; height:4px; background:#f5c16c"></div>
      <p style="font-size:40px">右</p>
    </div>
  </layer>
</layer>
```

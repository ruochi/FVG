# Flex Layer 速查

写法规则见 [AGENTS.md](../AGENTS.md) 的硬性约定。数字都是像素，y 轴向下。根元素 `<Layer width height>` 就是一个 Layer。

## 结构

| 标签 | 做什么 |
| --- | --- |
| `Layer` | 根画布兼定位容器。根上写 `width` `height` `background`（画布底色）`color` `safe`；定位用 `cx` `cy` `anchor`，还有 `opacity` `rotate` `scale` `origin`。可嵌套 |
| `draw` | 子标签。正文是 JS（`ctx`、`el`），画在父元素内容之后 |
| `div` 写 `display:flex` | 排布。默认横向；竖排加 `flex-direction:column`。`gap` `align-items` `justify-content` `padding` 都在 `style` 里 |

要定位一组 HTML，包一层 `Layer`，把 `cx` `cy` `anchor` 写在 `Layer` 上。

## 叶子怎么定位

| 叶子 | 在 Layer 里 | 在 flex 里 |
| --- | --- | --- |
| 文字 `h1` `h2` `h3` `p` `div` `span` | 外包 `Layer` 来定位。文字本身只写 `style` | 直接放 |
| 图片 `img`（`image` 相同） | 外包 `Layer`。`src` 是属性，宽高和 `object-fit` 写 `style` | 直接放，默认不缩小 |
| `Rect` | `cx cy width height`，或 `x1 y1 x2 y2` | 包一层有宽高的 Layer，或改用 div |
| `Ellipse` | `cx cy rx ry`，或两点写法 | 同上 |
| `Circle` | `cx cy r` | 同上 |
| `Line` `Arrow` `Polyline` `Polygon` `Path` `Curve` | `x1 y1 x2 y2` / `points` / `d`。`Curve` 闭合加 `closed` | 包一层 `<Layer>` |
| `symbol` / `use` | `symbol` 不画。`use href="#id"` 用 `cx cy` 摆放 | `use` 按它的宽高排进去 |

色块、圆点、分隔线用 div：`<div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4">`，分隔线用 `flex:1; height:4px`。

`fill` 可以写 `linear-gradient(to bottom, #0c1424, #6e7c72)`、`radial-gradient(at 40% 35%, #fff, #fff0)`，或 `gradient(#000, #fff)`。

<!-- attrs:effects:begin -->
效果：`shadow` `0 8 16 #00000055`（默认 颜色 `#00000066`）、`glow` `56 #f3ead4`（默认 颜色取本体）、`inner-shadow` `0 8 16 #00000055`（默认 同 shadow）、`inner-glow` `28 #7ec8ff`（默认 同 glow）、`blur` `6`、`backdrop-blur` `16`、`glass` `clear`、`noise` `0.08`、`filter` `saturate(1.1)`、`blend` `multiply`（默认 `source-over`）、`overlay` `#00000066`（默认 透明度 1，`source-over`）、`grade` `lomo 0.8, fade 0.1`（默认 强度 1）、`grade-mask` `radial-gradient(#fff0 30%, #fff)`。作用于整棵子树的 `overlay`、`grade`、`grade-mask` 只写在 `Layer` 上。
<!-- attrs:effects:end -->

竖排：`style="writing-mode:vertical-rl"`。字体名 `Song`、`Kai`、`Brush` 不用自带字体文件。

## 例子

```html
<Layer width="800" height="400" background="#0e1219" color="#f4f1ea">
  <Layer cx="40" cy="40" anchor="top-left">
    <div style="display:flex; gap:16px; align-items:center">
      <div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4"></div>
      <p style="font-size:40px">a² = 9</p>
    </div>
  </Layer>
  <Layer cx="400" cy="220" width="360" height="200">
    <Rect x1="0" y1="0" x2="160" y2="120" fill="#3ecfc4" />
    <Circle cx="200" cy="60" r="16" fill="#f4f1ea" />
    <Line x1="160" y1="60" x2="184" y2="60" stroke="#f4f1ea" stroke-width="4" />
  </Layer>
  <Layer width="120" height="80" cx="640" cy="300">
    <draw>
      ctx.fillStyle = '#f5c16c'
      ctx.fillRect(0, 0, el.w, el.h)
    </draw>
  </Layer>
</Layer>
```

```html
<Layer width="800" height="200" background="#0e1219" color="#f4f1ea">
  <Layer cx="40" cy="80" anchor="top-left">
    <div style="display:flex; width:720px; gap:16px; align-items:center">
      <p style="font-size:40px">左</p>
      <div style="flex:1; height:4px; background:#f5c16c"></div>
      <p style="font-size:40px">右</p>
    </div>
  </Layer>
</Layer>
```

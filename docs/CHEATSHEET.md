# FVG 速查

HTML 用 `style`，其余标签用属性。数字都是像素，y 轴向下。根元素 `<fvg width height>` 就是一个 Layer。

## 结构

| 标签 | 做什么 |
| --- | --- |
| `Layer` | 定位。属性：`cx` `cy` `anchor` `width` `height` `opacity` `rotate` `scale` `origin`。可嵌套 |
| `div` 写 `display:flex` | 排布。默认横向；竖排加 `flex-direction:column`。`gap` `align-items` `justify-content` `padding` `flex` 都在 `style` 里 |

要定位一组 HTML，包一层 `Layer`，把 `cx` `cy` `anchor` 写在 `Layer` 上。

## 叶子怎么定位

| 叶子 | 在 Layer 里 | 在 flex 里 |
| --- | --- | --- |
| 文字 `h1` `h2` `h3` `p` `div` `span` | 外包 `Layer` 来定位。文字本身只写 `style` | 直接放 |
| `Rect` | `cx cy width height`，或 `x1 y1 x2 y2`（对角，可反着写） | 不规范。包一层有宽高的 Layer，或改用 div |
| `Ellipse` | `cx cy rx ry`，或两点写法表示外接矩形 | 同上 |
| `Circle` | `cx cy r`（圆心） | 同上 |
| `Line` `Arrow` `Polyline` `Polygon` `Path` `Curve` | `x1 y1 x2 y2` / `points` / `d`，就是局部坐标。`Curve` 用 `points`，闭合加 `closed` | 不渲染。包一层 `<Layer>` |
| `symbol` / `use` | `symbol` 不画。`use href="#id"` 用 `cx cy` 摆放，可加 `rotate` `scale` | `use` 按它的宽高排进去 |

形状和自定义元素不用 `anchor`，也不写 `style`。色块、圆点、分隔线用 div：`<div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4">`，分隔线用 `flex:1; height:4px`。

`fill` 可以写 `linear-gradient(to bottom, #0c1424, #6e7c72)`、`radial-gradient(at 40% 35%, #fff, #fff0)`，或 `gradient(#000, #fff)`、`gradient(#f00 #0f0 / #00f #fff)`。效果：`shadow` / `inner-shadow`（`0 8 16 #00000055`）、`glow` / `inner-glow`（`56 #f3ead4`）、`blur` / `backdrop-blur`（单个像素）、`noise="0.08"`、`filter="saturate(1.1)"`、`blend="multiply"`。图形写属性，文字写在 `style` 里。

竖排：`style="writing-mode:vertical-rl"`。字体名 `Song`、`Kai`、`Brush` 不用自带字体文件。

## 属性归属

HTML 的字号、颜色、背景、间距、透明度、旋转都写在 `style` 里。`Layer` 和图形把这些写成属性。不认识的属性会保留给 `draw`。

## 报告

`warn` 表示写错了位置或会被忽略，`info` 的 `non-canonical` 表示照常渲染但不是规范写法。每条都有 `hint`。常见改法：

- 线条或两点坐标放进了 flex：包 `<Layer width height>`。
- 文字上写了 `cx`：改成 `<Layer cx cy anchor><p style="…">…</p></Layer>`。
- 文字盒子里放了 `h3`、`p`：改成 `<div style="display:flex; flex-direction:column">`。

## 例子

```html
<fvg width="800" height="400" background="#0e1219" color="#f4f1ea">
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
</fvg>
```

```html
<fvg width="800" height="200" background="#0e1219" color="#f4f1ea">
  <Layer cx="40" cy="80" anchor="top-left">
    <div style="display:flex; width:720px; gap:16px; align-items:center">
      <p style="font-size:40px">左</p>
      <div style="flex:1; height:4px; background:#f5c16c"></div>
      <p style="font-size:40px">右</p>
    </div>
  </Layer>
</fvg>
```

# FVG 速查

标签是 FVG 的，属性是 CSS 的。数字都是像素，y 轴向下。根元素 `<fvg width height>` 就是一个 Layer。

## 结构

| 标签 | 做什么 |
| --- | --- |
| `Layer` | 定位。子元素用局部坐标。可嵌套，`rotate` `scale` `opacity` 作用到整组。`origin` 默认 `center` |
| `Row` / `Column` | 只排布。`gap` `align-items` `justify-content` `padding`。要定位就包一层 Layer |

## 叶子怎么定位

| 叶子 | 在 Layer 里 | 在 Row/Column 里 |
| --- | --- | --- |
| 文字 `h1` `h2` `h3` `p` `div` `span` | `cx` `cy` + `anchor`（九宫格，默认 `center`） | 直接放 |
| `Rect` | `cx cy width height`，或 `x1 y1 x2 y2`（对角，可反着写） | 不规范。包一层 Layer，或改用 div |
| `Ellipse` | `cx cy rx ry`，或两点写法表示外接矩形 | 同上 |
| `Circle` | `cx cy r`（圆心） | 同上 |
| `Line` `Arrow` `Polyline` `Polygon` `Path` | `x1 y1 x2 y2` / `points` / `d`，就是局部坐标 | 不渲染。包一层 `<Layer>` |

形状和自定义元素不用 `anchor`。`Rect` 的 SVG 写法 `x y width height` 会按左上角渲染，但不是规范写法。

色块、圆点、分隔线用 div：`<div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4">`，分隔线用 `flex:1; height:4px`。

## 属性归属

文字和盒子的样式写在 `style` 里（`font-size`、`color`、`background`、`padding`）。图形的 `fill`、`stroke`、`stroke-width` 是属性，不写进 `style`。

`cx` `cy` `anchor` 只在 Layer 的子元素上。`flex` `flex-grow` `flex-shrink` 只在 Row/Column 的子元素上。`opacity` `rotate` `scale` `origin` 到处都能用。不认识的属性会保留给 `draw`。

## 报告

`warn` 表示写错了位置或会被忽略，`info` 的 `non-canonical` 表示照常渲染但不是规范写法。每条都有 `hint`。常见改法：

- 线条或两点坐标放进了 Row：包 `<Layer width height>`。
- Row 上写了 `cx`：改成 `<Layer cx cy anchor><Row>…</Row></Layer>`。
- 文字盒子里放了 `h3`、`p`：改用 `Column`。

## 例子

```html
<fvg width="800" height="400" background="#0e1219" color="#f4f1ea">
  <Layer cx="40" cy="40" anchor="top-left">
    <Row style="gap:16px; align-items:center">
      <div style="width:28px; height:28px; border-radius:14px; background:#3ecfc4"></div>
      <p style="font-size:40px">a² = 9</p>
    </Row>
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
    <Row style="width:720px; gap:16px; align-items:center">
      <p style="font-size:40px">左</p>
      <div style="flex:1; height:4px; background:#f5c16c"></div>
      <p style="font-size:40px">右</p>
    </Row>
  </Layer>
</fvg>
```

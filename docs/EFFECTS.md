# Flex Layer 滤镜 / 效果

现行规范见 [SPEC.md §7](../SPEC.md)。本文记录设计取舍与实现备注。

## 已实现

| 属性 | 说明 |
| --- | --- |
| `shadow` / `glow` | 外阴影 / 外发光 |
| `inner-shadow` / `inner-glow` | 内阴影 / 内发光（clip + 离屏挖空） |
| `blur` | 图层模糊（含 Layer 子树合成后再糊） |
| `backdrop-blur` | 背景模糊（采样主画布已有像素） |
| `glass` | iOS Liquid Glass：边缘弧面折射 + 色散 + 朝光高光，`clear` 零模糊 |
| `noise` | 确定性噪点，`soft-light` 叠加 |
| `filter` | 色彩滤镜（brightness / contrast / saturate / grayscale / hue-rotate / sepia / invert） |
| `blend` | 混合模式子集 |

归属：Layer / 图形 / 线条 → 属性；文字 / flex HTML → `style`。

绘制顺序：`backdrop-blur` / `glass` 取样 → `shadow` → `glow` → 本体 → `inner-shadow` → `inner-glow` → `noise`；若有 `blur` 或 `filter`，阴影到噪点先画进离屏再贴回。

## 墨迹原则

所有效果跟**着墨 alpha**，不跟布局 `box`：

| 元素 | 墨迹是什么 |
| --- | --- |
| 文字 | 字形（若有 `background` 则加上背景块） |
| 形状 / 线 | 填充与描边几何 |
| Layer | 自身 `border` / `<draw>` 着墨（**无** `background`；子元素各自算） |
| flex | 自身的 `background` / `border`（子元素各自算） |
| `blur` / `filter` / `blend` | 该节点已绘制像素（含子树合成） |

因此文字 `shadow` 是字形投影，不会落成一块矩形雾斑。

## `glass` 透镜

参照 iOS 26 Liquid Glass 与社区复刻（LiquidLens、liquid-glass-js、Outpace 等）的共同做法：玻璃是一块**中心平坦、边缘凸起**的厚片，光线只在边缘弧面发生弯折，中心看到的背景不变形。Liquid Glass 的辨识度来自「边缘透镜」，不是模糊。

实现（`src/paint.ts` `paintGlass`）：

1. **距离场**：对墨迹 alpha 做精确欧氏距离变换（Felzenszwalb EDT），得到每个像素到墨迹边缘的距离 `d`；轻微盒式平滑后取梯度作为向内法线。任何墨迹（圆角矩形、圆、文字）都能用，不依赖形状公式。
2. **弧面带**：`bezel = min(短边 × 24%, 64px, 内切半径)`。`d ≥ bezel` 的像素原样复制背景；弧面带内按 `t = d / bezel` 查位移表。
3. **位移曲线**：`shift = S·(1-t)²`，`S = bezel × 0.5 × refraction`。内沿处位移与斜率都归零，和平坦区无缝；`S ≤ bezel/2` 保证 `d + shift` 单调，背景在边缘被连续放大，不会翻折或被拉成一条线。
   - 试过按 squircle 表面 + Snell 定律（n=1.5）直接算位移：边缘斜率趋于无穷，整条弧面带几乎取同一条等距线，单帧里表现为放射状拉丝；故改用上面的平滑曲线，保留「边缘放大、中心清晰」的观感。
4. **取样**：沿法线向内偏移后双线性取样。`dispersion` > 0 时 R/G/B 用略不同的位移，边缘出现细微色散。
5. **高光**：外法线朝左上光源的一侧最亮，对侧有较弱回光；由边缘 1px 亮线 + 弧面内的柔光组成。
6. **模糊**：只有 `blur > 0` 才先糊背景再折射；`clear` 预设为 0。
7. **投影**：先取样背景，再画投影，最后贴玻璃，投影不会被玻璃「透」出来。

| 预设 | blur | refraction | bezel | dispersion | 默认色调 |
| --- | --- | --- | --- | --- | --- |
| `clear` | 0 | 1 | 0.24 | 0.06 | 无 |
| `regular` | 6 | 0.85 | 0.22 | 0.04 | `#ffffff14` |
| `thick` | 36 | 0.5 | 0.2 | 0 | `#ffffff2a` |

做不到：设备姿态实时高光、多层玻璃互相折射、系统级自适应明暗。

## 取舍

- `backdrop-blur` / `glass` 在主画布上采样，贴回时按墨迹 alpha 裁切。
- `glass` 与 `backdrop-blur` 同时出现时以 `glass` 为准（`info`）。
- `filter` 不含 `blur()` / `drop-shadow()`，避免与 `blur` / `shadow` 双通道。
- 同时写 `blur` 与 `filter`：模糊以 `blur` 为准，报 `info`。
- 勿占用：`outer-glow`、`drop-shadow`、`backdrop-filter`、`texture`。

## 实现触点

- `src/style.ts` — 解析
- `src/types.ts` / `src/layout.ts` — 字段与 `readEffects`
- `src/paint.ts` — 绘制
- `src/rules.ts` / `generate/serialize.ts` / JSX 类型 — 归属
- `src/report.ts` — 报告与 `effect-clipped`

# FVG 滤镜 / 效果

现行规范见 [SPEC.md §7](../SPEC.md)。本文记录设计取舍与实现备注。

## 已实现

| 属性 | 说明 |
| --- | --- |
| `shadow` / `glow` | 外阴影 / 外发光 |
| `inner-shadow` / `inner-glow` | 内阴影 / 内发光（clip + 离屏挖空） |
| `blur` | 图层模糊（含 Layer 子树合成后再糊） |
| `backdrop-blur` | 背景模糊（采样主画布已有像素） |
| `glass` | 近似 iOS Liquid Glass：模糊 + 径向透镜折射 + 顶部高光 |
| `noise` | 确定性噪点，`soft-light` 叠加 |
| `filter` | 色彩滤镜（brightness / contrast / saturate / grayscale / hue-rotate / sepia / invert） |
| `blend` | 混合模式子集 |

归属：Layer / 图形 / 线条 → 属性；文字 / flex HTML → `style`。

绘制顺序：`backdrop-blur` → `shadow` → `glow` → 本体 → `inner-shadow` → `inner-glow` → `noise`；若有 `blur` 或 `filter`，阴影到噪点先画进离屏再贴回。

## 墨迹原则

所有效果跟**着墨 alpha**，不跟布局 `box`：

| 元素 | 墨迹是什么 |
| --- | --- |
| 文字 | 字形（若有 `background` 则加上背景块） |
| 形状 / 线 | 填充与描边几何 |
| Layer / flex | 自身的 `background` / `border`（子元素各自算） |
| `blur` / `filter` / `blend` | 该节点已绘制像素（含子树合成） |

因此文字 `shadow` 是字形投影，不会落成一块矩形雾斑。

## `glass` 透镜

`glass` 在糊过的背景上做**径向取样位移**：越靠近墨迹边缘，越从中心方向取样，视觉上像透镜放大/折射。另加饱和度微调与顶部 specular。

能做：单帧海报里的边缘弯折、色块外扩、高光边。  
做不到：设备姿态实时高光、物理级多层折射、系统级自适应对比度。

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

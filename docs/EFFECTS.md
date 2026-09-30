# FVG 滤镜 / 效果

现行规范见 [SPEC.md §7](../SPEC.md)。本文记录设计取舍与实现备注。

## 已实现

| 属性 | 说明 |
| --- | --- |
| `shadow` / `glow` | 外阴影 / 外发光 |
| `inner-shadow` / `inner-glow` | 内阴影 / 内发光（clip + 离屏挖空） |
| `blur` | 图层模糊（含 Layer 子树合成后再糊） |
| `backdrop-blur` | 背景模糊（采样主画布已有像素） |
| `noise` | 确定性噪点，`soft-light` 叠加 |
| `filter` | 色彩滤镜（brightness / contrast / saturate / grayscale / hue-rotate / sepia / invert） |
| `blend` | 混合模式子集 |

归属：Layer / 图形 / 线条 → 属性；文字 / flex HTML → `style`。

绘制顺序：`backdrop-blur` → `shadow` → `glow` → 本体 → `inner-shadow` → `inner-glow` → `noise`；若有 `blur` 或 `filter`，阴影到噪点先画进离屏再贴回。

## 取舍

- `backdrop-blur` 在主画布上采样；若同元素还有图层 `blur`，毛玻璃本身不再被二次糊进离屏（半透明本体与图层模糊仍会作用）。
- `filter` 不含 `blur()` / `drop-shadow()`，避免与 `blur` / `shadow` 双通道。
- 同时写 `blur` 与 `filter`：模糊以 `blur` 为准，报 `info`。
- 勿占用：`outer-glow`、`drop-shadow`、`backdrop-filter`、`texture`、`glass`。

## 实现触点

- `src/style.ts` — 解析
- `src/types.ts` / `src/layout.ts` — 字段与 `readEffects`
- `src/paint.ts` — 绘制
- `src/rules.ts` / `generate/serialize.ts` / JSX 类型 — 归属
- `src/report.ts` — 报告与 `effect-clipped`

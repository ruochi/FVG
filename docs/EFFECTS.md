# FVG 滤镜 / 效果规划

本文是 **v0.2+ 候选效果** 的设计草案，不是现行规范。现行已实现的只有 `shadow`、`glow`（见 [SPEC.md §7](../SPEC.md)）。定稿前以本文与 SPEC 预留节为准；落地实现时再改 SPEC / CHEATSHEET / `rules.ts`。

## 1. 目标与边界

**要做的**：在海报 / 单帧画面上补齐设计工具里最常用的一层效果，写法与 `shadow`/`glow` 同一套规则。

**不做的（本规划范围外）**：

- CSS 整串 `filter: blur() brightness() …` 原样搬运（先按独立属性拆，语义更清晰）
- SVG `<filter>` / 自定义着色器管线
- 把 `opacity`、渐变 `fill`、描边再包装成「滤镜」
- 占用 3D 预留名：`rotateX`、`rotateY`、`z`、`perspective`、`Scene3D`

## 2. 必须对齐的现行规则

所有新效果一律遵守：

| 规则 | 约定 |
| --- | --- |
| 属性归属 | `Layer` / 形状 / 线条 → **属性**；文字 / flex HTML → **`style`**。新名字进 `HTML_STYLE_ATTRS` |
| 像素单位 | blur / offset / spread 一律像素，可写 `px`；不支持 `%` / `em` |
| 布局不变 | 不改 `box`；扩大绘制范围的进报告 `effect` / `ink` 相关检查 |
| 解析失败 | `invalid-attr` + 可照做的 `hint`；`none` 表示关闭 |
| 绘制与报告 | 进元素表字段；外扩越画布 → 已有 `effect-clipped`（必要时扩展文案） |
| 未知属性 | 仍留给 `draw`；**已列入规划的名字不要挪作他用** |

绘制顺序（定稿目标）：

```text
1. 外阴影 shadow
2. 外发光 glow
3. 本体（含 fill / stroke / 文字 / 子树）
4. 内阴影 inner-shadow
5. 内发光 inner-glow
6. 图层模糊 blur（作用在已画好的本元素像素上）
```

`backdrop-blur` **不在本元素绘制链里插队**：它在画本体半透明填充**之前**采样背后画布（见 §4.4）。

## 3. 分批落地

| 批次 | 属性名 | 优先级 | 依赖 / 风险 |
| --- | --- | --- | --- |
| **A** | `inner-shadow`、`blur` | 高 | 可复用现有 silhouette + canvas shadow；`blur` 需离屏缓冲 |
| **B** | `inner-glow`、`backdrop-blur` | 中 | 内发光对齐 glow 的 screen；backdrop 必须能读背后像素 |
| **C** | `noise`、色彩滤镜（见 §4.6）、`blend` | 低 | 可先继续用 `draw`；色彩滤镜可合并为一条 `filter` 字符串 |

建议：**先合 A 再合 B**；C 等有真实海报需求再开。

## 4. 各效果草案

### 4.1 `inner-shadow`（内阴影）— 批次 A

| 项 | 草案 |
| --- | --- |
| 语法 | 与 `shadow` 相同：`x y [blur] [spread] [color]` |
| 默认色 | `#00000066`（同外阴影） |
| 语义 | 沿**内侧**边缘投下阴影；颜色乘在本体之上，不外扩轮廓 |
| 布局 | 不改 `box`；一般**不**触发 `effect-clipped`（不外扩） |
| 绘制 | 在本体之后；用 clip 到元素轮廓 + 反向 silhouette / destination-in 一类手法 |

```html
<Rect cx="200" cy="120" width="320" height="180" rx="24" fill="#1a3352" inner-shadow="0 8 16 #00000088" />
<p style="inner-shadow:0 2 4 #00000055">凹陷字</p>
```

**开放问题**：文字内阴影是否第一期就做（字形 clip 成本更高）。建议 A1 先做形状 / Layer / 有背景的盒子，文字随后。

### 4.2 `blur`（图层模糊）— 批次 A

| 项 | 草案 |
| --- | --- |
| 语法 | `blur="12"` 或 `blur="12px"`（单个非负长度） |
| 语义 | 模糊**本元素已绘制像素**（含其子树在该节点上的合成结果？见开放问题） |
| 布局 | 不改 `box`；模糊半径外扩 → 计入 `effect-clipped`（与 glow 相同 pad 逻辑：约 `blur * 2`） |
| 绘制 | 本体（及可选子树）画到离屏 → `ctx.filter = blur(…)` 或手动卷积 → 贴回 |

```html
<Layer cx="540" cy="900" width="800" height="200" blur="8">
  <h2 style="font-size:64px">虚化标题</h2>
</Layer>
<Circle cx="100" cy="100" r="40" fill="#f4efe4" blur="6" />
```

**开放问题**：

1. `blur` 写在 `Layer` 上时，是只糊 Layer 的 chrome，还是糊整棵子树合成图？（建议：**整棵子树**，否则几乎无用。）
2. 与子元素自己的 `shadow`/`glow` 叠加时，先子后糊，还是先糊父？（建议：子先画进离屏，再对离屏做 blur。）

### 4.3 `inner-glow`（内发光）— 批次 B

| 项 | 草案 |
| --- | --- |
| 语法 | 与 `glow` 相同：`blur [spread] [color]` |
| 默认色 | 取本体填充 / 描边色（同外发光） |
| 语义 | 从内侧边缘向内加光；`screen` 混合 |
| 布局 | 不外扩，通常不 `effect-clipped` |
| 绘制 | 本体之后，对齐 `paintGlow`，但 clip 在轮廓内 |

```html
<Circle cx="520" cy="220" r="70" fill="#0c1424" inner-glow="24 #f3ead4" />
```

### 4.4 `backdrop-blur`（背景模糊 / 毛玻璃）— 批次 B

| 项 | 草案 |
| --- | --- |
| 语法 | `backdrop-blur="16"`（单个非负长度） |
| 语义 | 模糊的是**该元素背后、已被画到画布上的内容**，再透过本元素的半透明区域看见 |
| 前提 | 本元素需要半透明 `fill` / `background` / `opacity`，否则看不出效果 |
| 布局 | 不改 `box`；采样区域按元素轮廓（含 `border-radius`）；**不**因 blur 半径单独报 `effect-clipped`（糊的是已有像素） |
| 绘制 | 在填充本元素背景**之前**：按设备像素从主 canvas 抠出元素包围盒 → blur → clip 到轮廓 → 画回 → 再画半透明本体 |

```html
<Rect cx="540" cy="960" width="900" height="280" rx="32"
      fill="#ffffff22" backdrop-blur="20" border="1 #ffffff44" />
```

**开放问题**：

1. 根 `<fvg>` 能否写？建议允许，但背后只有 `background`，意义有限。
2. `overflow="hidden"` 祖先是否限制采样范围？建议：**采样用画布已有像素，clip 用本元素轮廓**；与祖先 clip 的交互跟普通绘制一致。
3. 实现成本高于 A；若 canvas 实现困难，批次 B 可拆成「先文档冻结语法，实现随后」。

### 4.5 `noise`（噪点）— 批次 C

| 项 | 草案 |
| --- | --- |
| 语法 | `noise="0.08"`（0–1 强度）或 `noise="0.08 #ffffff"`（强度 + 可选色） |
| 语义 | 在本体之上叠一层细粒噪声；默认不强行改色相 |
| 布局 | 不改 `box`，不外扩 |
| 绘制 | 离屏生成噪声纹理，`soft-light` / 低 alpha 叠在本体上 |

第一期可只支持形状与 Layer 盒子；文字可选。

### 4.6 色彩滤镜与 `blend` — 批次 C

**方案甲（推荐先做）**：单一属性 `filter`，子集接近 CSS，但**只允许下列函数**，空格分隔：

```text
filter="brightness(1.1) contrast(1.2) saturate(0.8) grayscale(0.2) hue-rotate(15) sepia(0.1) invert(0)"
```

- 角度：`hue-rotate` 用度（可写 `15` 或 `15deg`）
- 比例：0–1 或百分比（若支持 `%`，仅此属性例外，并在 SPEC 写明）
- **不含** `blur()` / `drop-shadow()`（避免与 `blur`、`shadow` 双通道）

**方案乙**：拆成 `brightness`、`contrast`… 多个属性。属性面更散，暂不推荐。

`blend`（混合模式）草案：`blend="screen"`，取值对齐 canvas `globalCompositeOperation` 的常用子集：`source-over`（默认）、`multiply`、`screen`、`overlay`、`soft-light`、`lighten`、`darken`。作用于**本元素整段绘制**（含其效果）与背后的合成。

## 5. 属性归属与保留名

写入归属表（与 `shadow`/`glow` 并列）：

```text
inner-shadow, inner-glow, blur, backdrop-blur, noise, filter, blend
```

HTML：`style="blur:8; backdrop-blur:16; …"`  
Layer / 图形：`blur="8" backdrop-blur="16"`

**保留、本阶段不实现但勿占用**：

| 名字 | 原因 |
| --- | --- |
| `outer-glow` | 已有 `glow` |
| `drop-shadow` | 已有 `shadow` |
| `backdrop-filter` | 用更短的 `backdrop-blur`；若将来扩展再升级 |
| `texture` / `glass` | 产品语义未定，避免提前占名 |

## 6. 报告与检查

| 字段 / code | 行为 |
| --- | --- |
| 元素表 | 有值则输出 `innerShadow`、`innerGlow`、`blur`、`backdropBlur`、`noise`、`filter`、`blend`（JSON 用 camelCase，与现有 `shadow`/`glow` 对象风格一致） |
| `effect-clipped` | 继续覆盖：外阴影、外发光、**图层 `blur`**；文案改为「阴影、光晕或模糊超出画布」 |
| 解析失败 | `invalid-attr` |
| 互斥 / 冲突 | 第一期不禁止叠加；若 `filter` 与独立 `blur` 同时出现，独立 `blur` 优先，并对 `filter` 报 `info` |

## 7. 实现触点（供后续 PR 勾选）

- [ ] `src/style.ts` — 解析函数
- [ ] `src/types.ts` — `*Spec` 与 `LayoutNode` 字段
- [ ] `src/layout.ts` — `readEffects` 扩展
- [ ] `src/rules.ts` / `generate/serialize.ts` / JSX 类型 — 归属与序列化
- [ ] `src/paint.ts` — 绘制顺序与离屏
- [ ] `src/report.ts` — 字段与 `effect-clipped`
- [ ] `SPEC.md` §7、§8、`docs/CHEATSHEET.md`、`AI.md` — 规范与速查
- [ ] 单测：`gradient.spec.ts` / `effects.spec.ts` 风格；每种效果至少 1 张金图或像素断言

## 8. 验收标准（每批次）

1. 归属写错会 `warn` + `hint`（HTML 误写属性、Layer 误写 `style`）。
2. 效果不改变 flex / 文字换行等布局结果（同输入 box 稳定）。
3. `fvg check` 对越界外扩效果给出 `effect-clipped`（适用于该效果时）。
4. 文档示例可复制；CHEATSHEET 有一行速记。
5. 现有 `shadow`/`glow` 金测与海报示例不回归。

## 9. 建议的下一 PR

**PR-A1**：只做 `inner-shadow`（形状 + Layer 盒子）+ 文档进 SPEC。  
**PR-A2**：`blur`（Layer 糊子树）+ `effect-clipped` 扩展。  
**PR-B1**：`inner-glow`。  
**PR-B2**：`backdrop-blur`（可独立排期）。  
**PR-C**：按需。

未实现前，复杂效果继续用程序侧 `draw`。

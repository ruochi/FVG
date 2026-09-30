/**
 * Vue 效果总览模板（与 examples/effects-gallery.fvg 同内容）。
 * 改效果时：先改 examples/effects-gallery.fvg 并重渲 PNG，再同步本文件。
 * 视觉手册：docs/EFFECTS.md
 *
 * 效果属性用静态字符串写出（与 SPEC 一致的 kebab-case），避免 Vue
 * 对 `inner-shadow` / `backdrop-blur` 动态绑定的歧义。
 */
import { renderVueFvg } from './renderVueFvg.js'

export function renderEffectsGalleryVue(): string {
  return renderVueFvg({
    template: `
<fvg width="1200" height="2600" background="#0e1218" color="#e8e4dc" font-family="Kai">
  <Rect x1="0" y1="0" x2="1200" y2="2600" fill="linear-gradient(to bottom, #0c1016, #162030 40%, #1c2836)" />

  <Layer cx="80" cy="56" anchor="top-left">
    <h1 style="font-size:64px; color:#f4efe6">FVG 效果一览</h1>
  </Layer>
  <Layer cx="80" cy="132" anchor="top-left">
    <p style="font-size:28px; color:#9aa7b5">shadow · glow · inner · blur · backdrop-blur · glass · noise · filter · blend</p>
  </Layer>
  <Layer cx="80" cy="176" anchor="top-left">
    <p style="font-size:28px; color:#6e7c8a">规范见 SPEC §7 · 手册 docs/EFFECTS.md · 本图为唯一总览</p>
  </Layer>

  <Layer cx="80" cy="240" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">1 · 外阴影 / 外发光</h2>
  </Layer>
  <Rect cx="220" cy="400" width="260" height="160" rx="22" fill="#3ecfc4" shadow="0 12 20 #00000088" />
  <Circle cx="600" cy="400" r="70" fill="#f4efe4" glow="36 #f4efe4" />
  <Rect cx="980" cy="400" width="260" height="160" rx="22" fill="#1e3a5f" shadow="0 12 18 #00000077" glow="26 #5b8fd4" />
  <Layer cx="220" cy="510" anchor="top"><p style="font-size:28px; color:#9aa7b5">shadow</p></Layer>
  <Layer cx="600" cy="510" anchor="top"><p style="font-size:28px; color:#9aa7b5">glow</p></Layer>
  <Layer cx="980" cy="510" anchor="top"><p style="font-size:28px; color:#9aa7b5">shadow + glow</p></Layer>

  <Layer cx="80" cy="580" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">2 · 内阴影 / 内发光</h2>
  </Layer>
  <Rect cx="220" cy="740" width="280" height="180" rx="22" fill="#6aa1ff" inner-shadow="0 10 16 #00000099" />
  <Rect cx="600" cy="740" width="280" height="180" rx="22" fill="#142033" inner-glow="28 #7ec8ff" />
  <Rect cx="980" cy="740" width="280" height="180" rx="22" fill="#2a1f18" inner-shadow="0 8 14 #000000aa" inner-glow="24 #f0a060" />
  <Layer cx="220" cy="860" anchor="top"><p style="font-size:28px; color:#9aa7b5">inner-shadow</p></Layer>
  <Layer cx="600" cy="860" anchor="top"><p style="font-size:28px; color:#9aa7b5">inner-glow</p></Layer>
  <Layer cx="980" cy="860" anchor="top"><p style="font-size:28px; color:#9aa7b5">inner both</p></Layer>

  <Layer cx="80" cy="930" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">3 · 图层模糊 / 色彩滤镜 / 噪点</h2>
  </Layer>
  <Rect cx="220" cy="1090" width="260" height="160" rx="22" fill="#f7931a" blur="6" />
  <Rect cx="600" cy="1090" width="260" height="160" rx="22" fill="#e85d4c" filter="grayscale(1)" />
  <Rect cx="980" cy="1090" width="260" height="160" rx="22" fill="#3ecfc4" noise="0.35 #ffffff" />
  <Layer cx="220" cy="1200" anchor="top"><p style="font-size:28px; color:#9aa7b5">blur</p></Layer>
  <Layer cx="600" cy="1200" anchor="top"><p style="font-size:28px; color:#9aa7b5">filter grayscale</p></Layer>
  <Layer cx="980" cy="1200" anchor="top"><p style="font-size:28px; color:#9aa7b5">noise</p></Layer>

  <Layer cx="80" cy="1270" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">4 · 背景采样 · backdrop-blur / glass</h2>
  </Layer>
  <Circle cx="220" cy="1500" r="90" fill="#ff5aa5" />
  <Circle cx="600" cy="1500" r="90" fill="#ff5aa5" />
  <Circle cx="980" cy="1500" r="90" fill="#ff5aa5" />
  <Rect x1="60" y1="1460" x2="380" y2="1472" fill="#ffffff" />
  <Rect x1="60" y1="1500" x2="380" y2="1512" fill="#ffd23f" />
  <Rect x1="60" y1="1540" x2="380" y2="1552" fill="#2ec4ff" />
  <Rect x1="440" y1="1460" x2="760" y2="1472" fill="#ffffff" />
  <Rect x1="440" y1="1500" x2="760" y2="1512" fill="#ffd23f" />
  <Rect x1="440" y1="1540" x2="760" y2="1552" fill="#2ec4ff" />
  <Rect x1="820" y1="1460" x2="1140" y2="1472" fill="#ffffff" />
  <Rect x1="820" y1="1500" x2="1140" y2="1512" fill="#ffd23f" />
  <Rect x1="820" y1="1540" x2="1140" y2="1552" fill="#2ec4ff" />
  <Rect cx="220" cy="1500" width="280" height="180" rx="28" fill="#ffffff33" backdrop-blur="16" border="1.5 #ffffff66" />
  <Rect cx="600" cy="1500" width="280" height="180" rx="28" fill="#ffffff00" glass="clear" />
  <Rect cx="980" cy="1500" width="280" height="180" rx="28" fill="#ffffff18" glass="thick" />
  <Layer cx="220" cy="1620" anchor="top"><p style="font-size:28px; color:#9aa7b5">backdrop-blur</p></Layer>
  <Layer cx="600" cy="1620" anchor="top"><p style="font-size:28px; color:#9aa7b5">glass clear · 零模糊折射</p></Layer>
  <Layer cx="980" cy="1620" anchor="top"><p style="font-size:28px; color:#9aa7b5">glass thick · 毛玻璃</p></Layer>

  <Layer cx="80" cy="1690" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">5 · 混合模式 blend</h2>
  </Layer>
  <Circle cx="200" cy="1850" r="64" fill="#ff6b6b" />
  <Circle cx="260" cy="1850" r="64" fill="#4ecdc4" blend="multiply" />
  <Circle cx="500" cy="1850" r="64" fill="#ffe66d" />
  <Circle cx="560" cy="1850" r="64" fill="#ff6b6b" blend="screen" />
  <Circle cx="800" cy="1850" r="64" fill="#6aa1ff" />
  <Circle cx="860" cy="1850" r="64" fill="#ff9f1c" blend="overlay" />
  <Layer cx="230" cy="1940" anchor="top"><p style="font-size:28px; color:#9aa7b5">multiply</p></Layer>
  <Layer cx="530" cy="1940" anchor="top"><p style="font-size:28px; color:#9aa7b5">screen</p></Layer>
  <Layer cx="830" cy="1940" anchor="top"><p style="font-size:28px; color:#9aa7b5">overlay</p></Layer>

  <Layer cx="80" cy="2010" anchor="top-left">
    <h2 style="font-size:36px; color:#c9d2dc">6 · 文字墨迹（style 里写效果）</h2>
  </Layer>
  <Layer cx="220" cy="2180" anchor="center">
    <h1 style="font-size:96px; color:#f4efe4; shadow:12 16 0 #ff5aa5">影</h1>
  </Layer>
  <Layer cx="600" cy="2180" anchor="center">
    <h1 style="font-size:96px; color:#f4efe4; glow:28 #7ec8ff">光</h1>
  </Layer>
  <Layer cx="980" cy="2180" anchor="center">
    <h1 style="font-size:96px; color:#e85d4c; filter:hue-rotate(180deg)">色</h1>
  </Layer>
  <Layer cx="220" cy="2280" anchor="top"><p style="font-size:28px; color:#9aa7b5">style shadow · 跟字形</p></Layer>
  <Layer cx="600" cy="2280" anchor="top"><p style="font-size:28px; color:#9aa7b5">style glow</p></Layer>
  <Layer cx="980" cy="2280" anchor="top"><p style="font-size:28px; color:#9aa7b5">style filter</p></Layer>

  <Layer cx="600" cy="2460" anchor="center">
    <p style="font-size:28px; color:#6e7c8a">全部按着墨 alpha，不按布局盒子</p>
  </Layer>
  <Layer cx="600" cy="2510" anchor="center">
    <p style="font-size:28px; color:#556270">generate/vue/effects-gallery.ts · examples/effects-gallery.fvg</p>
  </Layer>
</fvg>
    `,
  })
}

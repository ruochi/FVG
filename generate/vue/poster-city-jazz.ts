/**
 * 用 Vue 生成海报：城市爵士夜 · 1080×1620
 * 运行：npx tsx generate/vue/build-poster-city-jazz.mts
 */
import { renderVueFvg } from './renderVueFvg.js'

export type ScheduleItem = { time: string; act: string }
export type StarDot = { x: number; y: number; r: number; glow?: string }

export const cityJazzBindings = {
  title: '城市爵士夜',
  subtitle: 'JAZZ IN THE ALLEY',
  dateLine: '2026 · 03 · 21',
  venue: '外滩隧道 B2',
  door: '19:00 入场',
  stars: [
    { x: 120, y: 180, r: 3, glow: '14px' },
    { x: 280, y: 96, r: 2 },
    { x: 420, y: 220, r: 4, glow: '18px' },
    { x: 860, y: 140, r: 2 },
    { x: 960, y: 320, r: 3, glow: '12px' },
    { x: 180, y: 520, r: 2 },
    { x: 920, y: 88, r: 2 },
  ] as StarDot[],
  schedule: [
    { time: '19:30', act: 'Opening Trio · 暖场' },
    { time: '20:15', act: 'Sax & Keys' },
    { time: '21:00', act: 'Main Set · 四重奏' },
    { time: '22:30', act: 'Late Session' },
  ] as ScheduleItem[],
  perks: ['黑胶吧台', '即兴 Jam', '午夜小食'],
}

export function renderCityJazzPosterVue(): string {
  return renderVueFvg({
    template: `
<fvg style="width:1080px; height:1620px; background:#0a1628; color:#e8eef7; safe:48">
  <circle
    v-for="(s, i) in stars"
    :key="i"
    :cx="s.x"
    :cy="s.y"
    :style="'r:' + s.r + 'px; fill:#f6f1e7; opacity:0.75' + (s.glow ? '; glow:' + s.glow : '')"
  />

  <rect cx="540" cy="380" style="width:920px; height:520px; fill:#122a4a; rx:24px; shadow:0 16px 28px #00000088" />
  <circle cx="760" cy="300" style="r:120px; fill:#c9a227; opacity:0.12; glow:40px #c9a227" />
  <circle cx="760" cy="300" style="r:78px; fill:none; stroke:#c9a227; stroke-width:3px; opacity:0.6" />

  <p cx="72" cy="72" anchor="top-left" style="font-size:26px; letter-spacing:6px; color:#8fa8c8">LIVE</p>
  <p cx="1008" cy="72" anchor="top-right" style="font-size:26px; color:#8fa8c8">{{ dateLine }}</p>

  <column cx="540" cy="1040" anchor="center" style="width:936px; gap:24px; align-items:start">
    <column style="gap:8px; align-items:start">
      <p style="font-size:28px; letter-spacing:10px; color:#c9a227">{{ subtitle }}</p>
      <h1 style="font-size:112px; letter-spacing:8px; color:#f6f1e7; line-height:1.02">{{ title }}</h1>
      <p style="font-size:34px; color:#b8c9de">{{ venue }} · {{ door }}</p>
    </column>

    <rect style="width:936px; height:2px; fill:#2a4060" />

    <ScheduleBlock :items="schedule" />

    <row style="width:936px; gap:16px; align-items:center">
      <PerkTag v-for="(label, i) in perks" :key="i" :label="label" />
    </row>
  </column>

  <rect cx="540" cy="1560" style="width:1080px; height:120px; fill:#061018" />
  <p cx="540" cy="1560" anchor="center" style="font-size:28px; letter-spacing:4px; color:#6a849c">预约见小程序 · 现场少量站票</p>
</fvg>
    `,
    bindings: cityJazzBindings,
    components: {
      ScheduleBlock: {
        props: ['items'],
        template: `
          <column style="width:936px; gap:18px; align-items:start">
            <ScheduleRow
              v-for="(row, i) in items"
              :key="i"
              :time="row.time"
              :act="row.act"
            />
          </column>
        `,
        components: {
          ScheduleRow: {
            props: ['time', 'act'],
            template: `
              <row style="width:936px; gap:28px; align-items:center">
                <p style="font-size:32px; color:#c9a227; width:120px">{{ $props.time }}</p>
                <p style="font-size:34px; color:#e8eef7">{{ $props.act }}</p>
              </row>
            `,
          },
        },
      },
      PerkTag: {
        props: ['label'],
        template: `
          <div style="padding:12px 24px; border:2px solid #c9a227; border-radius:999px; font-size:28px; color:#f6f1e7">{{ $props.label }}</div>
        `,
      },
    },
  })
}

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
    { x: 120, y: 180, r: 3, glow: '14' },
    { x: 280, y: 96, r: 2 },
    { x: 420, y: 220, r: 4, glow: '18' },
    { x: 860, y: 140, r: 2 },
    { x: 960, y: 320, r: 3, glow: '12' },
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
<layer width="1080" height="1620" background="#0a1628" color="#e8eef7" safe="48">
  <circle
    v-for="(s, i) in stars"
    :key="i"
    :cx="s.x"
    :cy="s.y"
    :r="s.r"
    fill="#f6f1e7"
    opacity="0.75"
    :glow="s.glow"
  />

  <rect cx="540" cy="380" width="920" height="520" fill="#122a4a" rx="24" shadow="0 16 28 #00000088" />
  <circle cx="760" cy="300" r="120" fill="#c9a227" opacity="0.12" glow="40 #c9a227" />
  <circle cx="760" cy="300" r="78" fill="none" stroke="#c9a227" stroke-width="3" opacity="0.6" />

  <layer cx="72" cy="72" anchor="top-left">
    <p style="font-size:26px; letter-spacing:6px; color:#8fa8c8">LIVE</p>
  </layer>
  <layer cx="1008" cy="72" anchor="top-right">
    <p style="font-size:26px; color:#8fa8c8">{{ dateLine }}</p>
  </layer>

  <layer cx="540" cy="1040" anchor="center">
    <div style="display:flex; flex-direction:column; width:936px; gap:24px; align-items:start">
      <div style="display:flex; flex-direction:column; gap:8px; align-items:start">
        <p style="font-size:28px; letter-spacing:10px; color:#c9a227">{{ subtitle }}</p>
        <h1 style="font-size:112px; letter-spacing:8px; color:#f6f1e7; line-height:1.02">{{ title }}</h1>
        <p style="font-size:34px; color:#b8c9de">{{ venue }} · {{ door }}</p>
      </div>

      <div style="width:936px; height:2px; background:#2a4060"></div>

      <ScheduleBlock :items="schedule" />

      <div style="display:flex; width:936px; gap:16px; align-items:center">
        <PerkTag v-for="(label, i) in perks" :key="i" :label="label" />
      </div>
    </div>
  </layer>

  <rect cx="540" cy="1560" width="1080" height="120" fill="#061018" />
  <layer cx="540" cy="1560" anchor="center">
    <p style="font-size:28px; letter-spacing:4px; color:#6a849c">预约见小程序 · 现场少量站票</p>
  </layer>
</layer>
    `,
    bindings: cityJazzBindings,
    components: {
      ScheduleBlock: {
        props: ['items'],
        template: `
          <div style="display:flex; flex-direction:column; width:936px; gap:18px; align-items:start">
            <ScheduleRow
              v-for="(row, i) in items"
              :key="i"
              :time="row.time"
              :act="row.act"
            />
          </div>
        `,
        components: {
          ScheduleRow: {
            props: ['time', 'act'],
            template: `
              <div style="display:flex; width:936px; gap:28px; align-items:center">
                <p style="font-size:32px; color:#c9a227; width:120px">{{ $props.time }}</p>
                <p style="font-size:34px; color:#e8eef7">{{ $props.act }}</p>
              </div>
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

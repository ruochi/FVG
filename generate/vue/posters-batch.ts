/**
 * 十张互不相似的测试海报，全部由 Vue 模板生成。
 */
import { renderVueFvg } from './renderVueFvg.js'

export type BatchPoster = { id: string; source: string }

function vue(template: string, bindings: Record<string, unknown> = {}, components: Record<string, unknown> = {}): string {
  return renderVueFvg({ template, bindings, components: components as never })
}

export function renderBatchPosters(): BatchPoster[] {
  const ticket = vue(
    `<fvg style="width:780px; height:1200px; background:#1a0b0c; color:#f4e6d4; safe:36">
      <rect cx="390" cy="28" style="width:780px; height:16px; fill:#e23b2f" />
      <p cx="48" cy="72" anchor="top-left" style="font-size:22px; letter-spacing:6px; color:#e23b2f; white-space:nowrap">ADMIT ONE</p>
      <p cx="732" cy="72" anchor="top-right" style="font-size:22px; color:#c4a48a; white-space:nowrap">NO. 0841</p>
      <h1 cx="390" cy="280" anchor="center" style="font-size:220px; color:#f4e6d4; white-space:nowrap">A12</h1>
      <p cx="390" cy="430" anchor="center" style="font-size:28px; letter-spacing:8px; color:#c4a48a; white-space:nowrap">座号</p>
      <line x1="80" y1="500" x2="700" y2="500" style="stroke:#5a3030; stroke-width:2px; stroke-dasharray:8 8" />
      <column cx="80" cy="540" anchor="top-left" style="width:620px; gap:18px; align-items:start">
        <row v-for="row in rows" :key="row.k" style="width:620px; align-items:center">
          <p style="font-size:26px; color:#c4a48a; width:160px; white-space:nowrap">{{ row.k }}</p>
          <p style="font-size:32px; color:#f4e6d4; white-space:nowrap">{{ row.v }}</p>
        </row>
      </column>
      <row cx="390" cy="1080" anchor="center" style="gap:8px">
        <rect v-for="(bar, i) in bars" :key="i" :style="'width:' + bar + 'px; height:72px; fill:#f4e6d4'" />
      </row>
    </fvg>`,
    {
      rows: [
        { k: '场次', v: '03 月 21 日 19:30' },
        { k: '厅', v: '北厅' },
        { k: '票价', v: '¥ 180' },
      ],
      bars: [6, 10, 4, 14, 8, 18, 6, 12, 4, 16, 8, 6, 20, 10, 4],
    },
  )

  const album = vue(
    `<fvg style="width:1080px; height:1080px; background:#10241c; color:#e7f6ee; safe:48">
      <circle cx="540" cy="400" style="r:220px; fill:#0b1612; stroke:#7dffa8; stroke-width:10px" />
      <circle cx="540" cy="400" style="r:70px; fill:#7dffa8" />
      <circle cx="540" cy="400" style="r:16px; fill:#10241c" />
      <h1 cx="540" cy="720" anchor="center" style="font-size:72px; color:#e7f6ee; white-space:nowrap">绿洲录音</h1>
      <p cx="540" cy="800" anchor="center" style="font-size:28px; letter-spacing:6px; color:#7dffa8; white-space:nowrap">SIDE A</p>
      <row cx="540" cy="920" anchor="center" style="gap:28px">
        <p v-for="t in tracks" :key="t" style="font-size:26px; color:#b7d8c4; white-space:nowrap">{{ t }}</p>
      </row>
    </fvg>`,
    { tracks: ['01 潮', '02 岸', '03 风'] },
  )

  const weather = vue(
    `<fvg style="width:900px; height:1500px; background:#d7eef8; color:#14324a; safe:40">
      <p cx="60" cy="70" anchor="top-left" style="font-size:28px; color:#3d6d88; white-space:nowrap">上海 · 晴间多云</p>
      <h1 cx="60" cy="160" anchor="top-left" style="font-size:220px; color:#14324a; white-space:nowrap">18°</h1>
      <p cx="60" cy="420" anchor="top-left" style="font-size:36px; color:#3d6d88; white-space:nowrap">体感 16°  东北风 3 级</p>
      <rect cx="450" cy="980" style="width:780px; height:640px; rx:28px; fill:#ffffff; shadow:0 12px 24px #14324a22" />
      <column cx="110" cy="700" anchor="top-left" style="width:680px; gap:8px; align-items:start">
        <row v-for="h in hours" :key="h.t" style="width:680px; align-items:center">
          <p style="width:140px; font-size:30px; color:#3d6d88; white-space:nowrap">{{ h.t }}</p>
          <p style="width:220px; font-size:30px; color:#14324a; white-space:nowrap">{{ h.s }}</p>
          <p style="font-size:34px; color:#14324a; white-space:nowrap">{{ h.c }}</p>
        </row>
      </column>
    </fvg>`,
    {
      hours: [
        { t: '08:00', s: '多云', c: '14°' },
        { t: '11:00', s: '晴', c: '17°' },
        { t: '14:00', s: '晴', c: '18°' },
        { t: '17:00', s: '阴', c: '16°' },
        { t: '20:00', s: '小雨', c: '13°' },
      ],
    },
  )

  const metro = vue(
    `<fvg style="width:1680px; height:840px; background:#f4f1ea; color:#1c1a17; safe:40">
      <p cx="64" cy="48" anchor="top-left" style="font-size:28px; letter-spacing:4px; color:#8a8175; white-space:nowrap">市域线路</p>
      <h1 cx="64" cy="96" anchor="top-left" style="font-size:64px; white-space:nowrap">今日停靠</h1>
      <line v-for="line in lines" :key="line.name" :x1="120" :y1="line.y" :x2="1560" :y2="line.y" :style="'stroke:' + line.color + '; stroke-width:14px'" />
      <circle v-for="stop in stops" :key="stop.id" :cx="stop.x" :cy="stop.y" style="r:16px; fill:#f4f1ea; stroke:#1c1a17; stroke-width:4px" />
      <p v-for="stop in stops" :key="stop.id + 'l'" :cx="stop.x" :cy="stop.y + 36" anchor="top" style="font-size:22px; white-space:nowrap">{{ stop.name }}</p>
      <p v-for="line in lines" :key="line.name + 'n'" cx="64" :cy="line.y" anchor="left" :style="'font-size:26px; color:' + line.color + '; white-space:nowrap'">{{ line.name }}</p>
    </fvg>`,
    {
      lines: [
        { name: '1', y: 280, color: '#e23b2f' },
        { name: '2', y: 460, color: '#1f7a4d' },
        { name: '3', y: 640, color: '#2458a6' },
      ],
      stops: [
        { id: 'a', name: '江湾', x: 280, y: 280 },
        { id: 'b', name: '人民广场', x: 760, y: 280 },
        { id: 'c', name: '徐汇', x: 1240, y: 280 },
        { id: 'd', name: '北站', x: 420, y: 460 },
        { id: 'e', name: '静安', x: 980, y: 460 },
        { id: 'f', name: '南码头', x: 560, y: 640 },
        { id: 'g', name: '世博', x: 1100, y: 640 },
      ],
    },
  )

  const exhibit = vue(
    `<fvg style="width:1080px; height:1620px; background:#f3efe6; color:#1a1814; safe:64">
      <line x1="80" y1="80" x2="80" y2="1540" style="stroke:#1a1814; stroke-width:2px" />
      <p cx="110" cy="90" anchor="top-left" style="font-size:24px; letter-spacing:6px; white-space:nowrap">美术馆 三月</p>
      <h1 cx="140" cy="620" anchor="left" style="font-size:280px; white-space:nowrap">墨</h1>
      <p cx="140" cy="980" anchor="top-left" style="font-size:36px; white-space:nowrap">纸本水墨 · 十二件</p>
      <p cx="140" cy="1040" anchor="top-left" style="font-size:28px; color:#5c564c; white-space:nowrap">3.12 — 5.02  免费预约</p>
      <rect cx="860" cy="1480" style="width:280px; height:8px; fill:#1a1814" />
    </fvg>`,
  )

  const menu = vue(
    `<fvg style="width:860px; height:1500px; background:#24160f; color:#f6efe6; safe:40">
      <p cx="430" cy="80" anchor="center" style="font-size:24px; letter-spacing:8px; color:#e07a3a; white-space:nowrap">SUPPER</p>
      <h1 cx="430" cy="130" anchor="center" style="font-size:72px; white-space:nowrap">晚饭</h1>
      <column cx="70" cy="280" anchor="top-left" style="width:720px; gap:22px; align-items:start">
        <row v-for="d in dishes" :key="d.name" style="width:720px; align-items:center">
          <p style="width:460px; font-size:34px; white-space:nowrap">{{ d.name }}</p>
          <p style="font-size:32px; color:#e07a3a; white-space:nowrap">{{ d.price }}</p>
        </row>
      </column>
      <p cx="430" cy="1400" anchor="center" style="font-size:24px; color:#a89080; white-space:nowrap">当日售罄即止</p>
    </fvg>`,
    {
      dishes: [
        { name: '番茄牛腩', price: '68' },
        { name: '清炒时蔬', price: '32' },
        { name: '米饭', price: '4' },
        { name: '酸梅汤', price: '12' },
        { name: '桂花糕', price: '18' },
      ],
    },
  )

  const derby = vue(
    `<fvg style="width:1500px; height:860px; background:#0e1a14; color:#f4f7f2; safe:32">
      <rect cx="375" cy="430" style="width:750px; height:860px; fill:#143024" />
      <rect cx="1125" cy="430" style="width:750px; height:860px; fill:#10243a" />
      <p cx="375" cy="180" anchor="center" style="font-size:32px; letter-spacing:6px; color:#8fbfa2; white-space:nowrap">主队</p>
      <p cx="1125" cy="180" anchor="center" style="font-size:32px; letter-spacing:6px; color:#8eb4d6; white-space:nowrap">客队</p>
      <h1 cx="375" cy="400" anchor="center" style="font-size:200px; white-space:nowrap">2</h1>
      <h1 cx="1125" cy="400" anchor="center" style="font-size:200px; white-space:nowrap">1</h1>
      <p cx="750" cy="430" anchor="center" style="font-size:48px; color:#f4f7f2; white-space:nowrap">终场</p>
    </fvg>`,
  )

  const fern = vue(
    `<fvg style="width:980px; height:1400px; background:#f7f3ea; color:#2a3228; safe:48">
      <ellipse cx="490" cy="460" style="rx:220px; ry:280px; fill:#e4efe0; stroke:#2f6b45; stroke-width:3px" />
      <ellipse cx="490" cy="460" style="rx:70px; ry:150px; fill:#2f6b45" />
      <line x1="120" y1="860" x2="860" y2="860" style="stroke:#2a3228; stroke-width:1px" />
      <p cx="120" cy="900" anchor="top-left" style="font-size:22px; letter-spacing:4px; color:#6d7a68; white-space:nowrap">PLATE 07</p>
      <h1 cx="120" cy="950" anchor="top-left" style="font-size:64px; white-space:nowrap">肾蕨</h1>
      <p cx="120" cy="1040" anchor="top-left" style="font-size:28px; color:#4d5c48; white-space:nowrap">Nephrolepis cordifolia</p>
      <p cx="120" cy="1120" anchor="top-left" style="font-size:26px; color:#4d5c48; width:740px">林下阴湿处。羽片对生，孢子囊群沿叶缘排列。</p>
    </fvg>`,
  )

  const market = vue(
    `<fvg style="width:1080px; height:1620px; background:#fff6ea; color:#2a140c; safe:40">
      <rect cx="540" cy="160" style="width:1080px; height:220px; fill:#d23a2a" />
      <h1 cx="540" cy="160" anchor="center" style="font-size:84px; color:#fff6ea; white-space:nowrap">早市</h1>
      <column cx="80" cy="320" anchor="top-left" style="width:920px; gap:20px; align-items:start">
        <row v-for="s in stalls" :key="s.name" style="width:920px; height:120px; align-items:center; background:#ffffff; padding:0 28px">
          <p :style="'width:28px; height:72px; background:' + s.color"></p>
          <p style="width:36px"></p>
          <p style="width:520px; font-size:40px; white-space:nowrap">{{ s.name }}</p>
          <p style="font-size:32px; color:#8a5a3a; white-space:nowrap">{{ s.where }}</p>
        </row>
      </column>
      <p cx="540" cy="1520" anchor="center" style="font-size:26px; color:#8a5a3a; white-space:nowrap">周六 6:00 — 11:00</p>
    </fvg>`,
    {
      stalls: [
        { name: '豆腐', where: '东棚', color: '#d23a2a' },
        { name: '鲜花', where: '中棚', color: '#e07a2f' },
        { name: '鲜鱼', where: '西棚', color: '#2f6b8a' },
        { name: '青菜', where: '南棚', color: '#3d8a4a' },
      ],
    },
  )

  const month = vue(
    `<fvg style="width:1100px; height:1100px; background:#f2f4f7; color:#1d2430; safe:36">
      <h1 cx="64" cy="48" anchor="top-left" style="font-size:64px; white-space:nowrap">三月</h1>
      <p cx="1036" cy="72" anchor="top-right" style="font-size:28px; color:#6b7688; white-space:nowrap">2026</p>
      <row cx="64" cy="160" anchor="top-left" style="gap:8px">
        <p v-for="d in heads" :key="d" style="width:132px; font-size:22px; color:#6b7688; text-align:center; white-space:nowrap">{{ d }}</p>
      </row>
      <column cx="64" cy="220" anchor="top-left" style="gap:8px">
        <row v-for="(week, wi) in weeks" :key="wi" style="gap:8px">
          <div v-for="day in week" :key="day.n" :style="'width:132px; height:120px; background:' + (day.on ? '#ffffff' : 'transparent') + '; padding:12px'">
            <p :style="'font-size:28px; color:' + (day.mark ? '#d23a2a' : '#1d2430')">{{ day.n }}</p>
          </div>
        </row>
      </column>
    </fvg>`,
    {
      heads: ['一', '二', '三', '四', '五', '六', '日'],
      weeks: [
        ['', '', '', '', '', '', '1'].map((n, i) => ({ n, on: n !== '', mark: i === 6 })),
        ['2', '3', '4', '5', '6', '7', '8'].map((n) => ({ n, on: true, mark: n === '8' })),
        ['9', '10', '11', '12', '13', '14', '15'].map((n) => ({ n, on: true, mark: n === '15' })),
        ['16', '17', '18', '19', '20', '21', '22'].map((n) => ({ n, on: true, mark: false })),
        ['23', '24', '25', '26', '27', '28', '29'].map((n) => ({ n, on: true, mark: n === '28' })),
        ['30', '31', '', '', '', '', ''].map((n) => ({ n, on: n !== '', mark: false })),
      ],
    },
  )

  return [
    { id: 'seat-ticket', source: ticket },
    { id: 'green-album', source: album },
    { id: 'harbor-weather', source: weather },
    { id: 'metro-stops', source: metro },
    { id: 'ink-exhibit', source: exhibit },
    { id: 'supper-menu', source: menu },
    { id: 'derby-score', source: derby },
    { id: 'fern-plate', source: fern },
    { id: 'morning-market', source: market },
    { id: 'march-grid', source: month },
  ]
}

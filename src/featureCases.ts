export type ProbeCtx = {
  byId(id: string): {
    box: { x: number; y: number; width: number; height: number }
    ink: { x: number; y: number; width: number; height: number }
    fontSize?: number
    lines?: Array<{ text: string }>
  }
  issue(code: string, present?: boolean): void
  eq(actual: number, expected: number, label: string): void
  close(actual: number, expected: number, label: string, tol?: number): void
  lines(id: string): string[]
  fontSize(id: string, size: number): void
  words(id: string, words: string[]): void
  noLineStart(id: string, chars: string): void
  color(x: number, y: number, hex: string, tol?: number): void
  alpha(x: number, y: number, expected: number, tol?: number): void
  region(x: number, y: number, w: number, h: number, mode: 'ink' | 'clear'): void
  inkBand(id: string, from: number, to: number, hex: string, tol?: number): void
  noId(id: string): void
  fail(message: string): void
}

export type FeatureCase = {
  id: string
  feature: string
  source: string
  assert: (ctx: ProbeCtx) => void
}

function scene(w: number, h: number, body: string, attrs = ''): string {
  return `<fvg width="${w}" height="${h}" background="#ffffff" color="#000000" ${attrs}>${body}</fvg>`
}

/** 特性清单。报告核对布局，像素核对绘制。 */
export const featureCases: FeatureCase[] = [
  {
    id: 'layout.default-center',
    feature: '没写 cx/cy 时放在 Layer 中心',
    source: scene(100, 80, `<Rect id="r" width="20" height="10" fill="#000"/>`),
    assert(ctx) {
      const b = ctx.byId('r').box
      ctx.eq(b.x, 40, 'x')
      ctx.eq(b.y, 35, 'y')
      ctx.color(50, 40, '#000')
    },
  },
  {
    id: 'layout.y-down',
    feature: 'y 轴向下，cy 越大越靠下',
    source: scene(80, 100, `<Rect id="hi" width="8" height="8" cx="20" cy="16" fill="#000"/><Rect id="lo" width="8" height="8" cx="20" cy="70" fill="#000"/>`),
    assert(ctx) {
      ctx.eq(ctx.byId('hi').box.y, 12, '上边 y')
      ctx.eq(ctx.byId('lo').box.y, 66, '下边 y')
    },
  },
  {
    id: 'layout.anchor-top-left',
    feature: 'anchor=top-left 时左上角落在 cx,cy',
    source: scene(160, 100, `<Rect id="r" width="20" height="10" cx="10" cy="12" anchor="top-left" fill="#000"/>`),
    assert(ctx) {
      ctx.eq(ctx.byId('r').box.x, 10, 'x')
      ctx.eq(ctx.byId('r').box.y, 12, 'y')
      ctx.color(14, 16, '#000')
      ctx.color(2, 2, '#fff')
    },
  },
  {
    id: 'layout.anchor-bottom-right',
    feature: 'anchor=bottom-right 时右下角落在 cx,cy',
    source: scene(120, 90, `<Rect id="r" width="20" height="10" cx="120" cy="90" anchor="bottom-right" fill="#000"/>`),
    assert(ctx) {
      ctx.eq(ctx.byId('r').box.x, 100, 'x')
      ctx.eq(ctx.byId('r').box.y, 80, 'y')
    },
  },
  {
    id: 'layout.explicit-size',
    feature: '写了宽高就严格使用',
    source: scene(80, 60, `<Rect id="r" width="36" height="18" fill="#000"/>`),
    assert(ctx) {
      ctx.eq(ctx.byId('r').box.width, 36, '宽')
      ctx.eq(ctx.byId('r').box.height, 18, '高')
    },
  },
  {
    id: 'layout.layer-local',
    feature: 'Layer 子元素用局部坐标',
    source: scene(160, 120, `<Layer width="80" height="60" cx="20" cy="10" anchor="top-left"><Rect id="inner" width="10" height="10" cx="5" cy="6" anchor="top-left" fill="#000"/></Layer>`),
    assert(ctx) {
      ctx.eq(ctx.byId('inner').box.x, 25, 'x')
      ctx.eq(ctx.byId('inner').box.y, 16, 'y')
      ctx.color(27, 18, '#000')
      ctx.color(2, 2, '#fff')
    },
  },
  {
    id: 'layout.layer-shrink',
    feature: 'Layer 不写尺寸时包住子元素',
    source: scene(200, 160, `<Layer id="g"><Rect id="a" width="10" height="10" cx="0" cy="0" anchor="top-left"/><Rect id="b" width="10" height="10" cx="40" cy="24" anchor="top-left"/></Layer>`),
    assert(ctx) {
      ctx.eq(ctx.byId('g').box.width, 50, '宽')
      ctx.eq(ctx.byId('g').box.height, 34, '高')
      ctx.eq(ctx.byId('b').box.x - ctx.byId('a').box.x, 40, '横向间距')
      ctx.eq(ctx.byId('b').box.y - ctx.byId('a').box.y, 24, '纵向间距')
    },
  },
  {
    id: 'layout.row-gap',
    feature: 'Row 按 gap 横排',
    source: scene(160, 40, `<Row cx="0" cy="0" anchor="top-left" style="gap:10px"><Rect id="a" width="20" height="10" fill="#000"/><Rect id="b" width="20" height="10" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.eq(ctx.byId('a').box.x, 0, 'a.x')
      ctx.eq(ctx.byId('b').box.x, 30, 'b.x')
      ctx.color(8, 5, '#000')
      ctx.color(25, 5, '#fff')
      ctx.color(36, 5, '#000')
    },
  },
  {
    id: 'layout.column',
    feature: 'Column 纵向排列',
    source: scene(40, 80, `<Column cx="0" cy="0" anchor="top-left" style="gap:6px"><Rect id="a" width="16" height="10" fill="#000"/><Rect id="b" width="16" height="10" fill="#000"/></Column>`),
    assert(ctx) {
      ctx.eq(ctx.byId('a').box.y, 0, 'a.y')
      ctx.eq(ctx.byId('b').box.y, 16, 'b.y')
    },
  },
  {
    id: 'layout.row-ignores-cx',
    feature: 'Row 里的 cx/cy 不参与定位',
    source: scene(200, 100, `<Row cx="100" cy="50"><Rect id="a" width="20" height="10" cx="0" cy="0" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.eq(ctx.byId('a').box.x, 90, 'x')
      ctx.eq(ctx.byId('a').box.y, 45, 'y')
      ctx.color(2, 2, '#fff')
      ctx.color(96, 48, '#000')
    },
  },
  {
    id: 'layout.justify-end',
    feature: 'justify-content:end 把子元素推到末尾',
    source: scene(120, 30, `<Row cx="0" cy="0" anchor="top-left" style="width:100px; justify-content:end"><Rect id="a" width="20" height="10" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.eq(ctx.byId('a').box.x, 80, 'x')
    },
  },
  {
    id: 'layout.align-center',
    feature: 'align-items 默认居中',
    source: scene(100, 50, `<Row cx="0" cy="0" anchor="top-left" style="width:80px; height:40px"><Rect id="a" width="20" height="10" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.eq(ctx.byId('a').box.y, 15, 'y')
      ctx.color(8, 4, '#fff')
      ctx.color(8, 20, '#000')
    },
  },
  {
    id: 'layout.safe',
    feature: 'safe 用像素边距检查文字',
    source: `<fvg width="200" height="200" background="#fff" safe="40"><p id="t" cx="10" cy="100" anchor="left" style="font-size:32px">A</p></fvg>`,
    assert(ctx) {
      ctx.issue('outside-safe')
    },
  },
  {
    id: 'text.default-size',
    feature: 'h1/h2/h3/p 的默认字号',
    source: scene(800, 800, `<h1 id="h1">甲</h1><h2 id="h2">甲</h2><h3 id="h3">甲</h3><p id="p">甲</p>`),
    assert(ctx) {
      ctx.fontSize('h1', 88)
      ctx.fontSize('h2', 64)
      ctx.fontSize('h3', 48)
      ctx.fontSize('p', 40)
    },
  },
  {
    id: 'text.br',
    feature: 'br 硬换行',
    source: scene(400, 200, `<p id="t">甲<br/>乙</p>`),
    assert(ctx) {
      const lines = ctx.lines('t')
      if (lines.length < 2) ctx.fail(`期望至少两行，实际 ${JSON.stringify(lines)}`)
      if (!lines.some((l) => l.includes('甲')) || !lines.some((l) => l.includes('乙'))) ctx.fail(`行内容不对 ${JSON.stringify(lines)}`)
    },
  },
  {
    id: 'text.auto-wrap',
    feature: '超出可用宽度时自动换行并记 auto-wrap',
    source: scene(160, 240, `<p id="t">比特币减半是每四年一次的事件</p>`),
    assert(ctx) {
      ctx.issue('auto-wrap')
      if (ctx.lines('t').length < 2) ctx.fail(`期望换行，实际 ${JSON.stringify(ctx.lines('t'))}`)
    },
  },
  {
    id: 'text.nowrap',
    feature: 'white-space:nowrap 不换行',
    source: scene(160, 80, `<p id="t" style="white-space:nowrap">比特币减半是每四年一次的事件</p>`),
    assert(ctx) {
      ctx.issue('auto-wrap', false)
      ctx.eq(ctx.lines('t').length, 1, '行数')
    },
  },
  {
    id: 'text.width-wrap',
    feature: '写了 width 就按这个宽度换行',
    source: scene(400, 240, `<p id="t" style="width:80px">比特币减半是一件大事</p>`),
    assert(ctx) {
      ctx.issue('auto-wrap', false)
      if (ctx.lines('t').length < 2) ctx.fail(`期望按宽度换行，实际 ${JSON.stringify(ctx.lines('t'))}`)
    },
  },
  {
    id: 'text.align-center',
    feature: 'text-align:center 把字画在盒子中间',
    source: scene(220, 80, `<p id="t" cx="0" cy="0" anchor="top-left" style="width:200px; font-size:40px; text-align:center; color:#000">中</p>`),
    assert(ctx) {
      const b = ctx.byId('t').box
      ctx.region(b.x + 4, b.y + 2, 28, Math.max(8, b.height - 4), 'clear')
      ctx.region(b.x + b.width / 2 - 12, b.y + 2, 24, Math.max(8, b.height - 4), 'ink')
    },
  },
  {
    id: 'text.color',
    feature: '文字颜色画进着墨范围',
    source: scene(200, 120, `<p id="t" cx="8" cy="8" anchor="top-left" style="font-size:64px; color:#ff0000">字</p>`),
    assert(ctx) {
      ctx.inkBand('t', 0.2, 0.8, '#ff0000', 90)
    },
  },
  {
    id: 'text.inline-color',
    feature: '行内 span 可以换颜色',
    source: scene(240, 100, `<p id="t" cx="4" cy="4" anchor="top-left" style="font-size:48px; color:#ff0000">左<span style="color:#0000ff">右</span></p>`),
    assert(ctx) {
      ctx.inkBand('t', 0.05, 0.35, '#ff0000', 100)
      ctx.inkBand('t', 0.65, 0.95, '#0000ff', 100)
    },
  },
  {
    id: 'text.english-word',
    feature: '英文单词不拆开',
    source: scene(400, 160, `<p id="t" style="width:140px; font-size:40px">Hello World</p>`),
    assert(ctx) {
      ctx.words('t', ['Hello', 'World'])
    },
  },
  {
    id: 'text.line-break-punct',
    feature: '逗号不出现在行首',
    source: scene(300, 160, `<p id="t" style="width:48px; font-size:40px">甲，乙</p>`),
    assert(ctx) {
      ctx.noLineStart('t', '，。、；：？！')
      if (ctx.lines('t').length < 2) ctx.fail(`期望换行后才能看出避头尾，实际 ${JSON.stringify(ctx.lines('t'))}`)
    },
  },
  {
    id: 'shape.rect',
    feature: 'Rect 按 fill 填充',
    source: scene(80, 60, `<Rect id="r" width="30" height="20" cx="10" cy="14" anchor="top-left" fill="#00aa00"/>`),
    assert(ctx) {
      ctx.color(20, 22, '#00aa00', 12)
      ctx.color(2, 2, '#fff')
    },
  },
  {
    id: 'shape.circle',
    feature: 'Circle 圆心着色、包围盒角上是空的',
    source: scene(100, 100, `<Circle id="c" r="16" cx="40" cy="40" fill="#000"/>`),
    assert(ctx) {
      ctx.color(40, 40, '#000')
      ctx.color(25, 25, '#fff')
    },
  },
  {
    id: 'shape.ellipse',
    feature: 'Ellipse 用 rx、ry',
    source: scene(120, 80, `<Ellipse id="e" rx="30" ry="12" cx="50" cy="40" fill="#000"/>`),
    assert(ctx) {
      ctx.color(50, 40, '#000')
      ctx.color(74, 40, '#000')
      ctx.color(50, 22, '#fff')
    },
  },
  {
    id: 'shape.stroke',
    feature: 'fill=none 只描边',
    source: scene(80, 70, `<Rect id="r" width="40" height="24" cx="16" cy="16" anchor="top-left" fill="none" stroke="#000" stroke-width="4"/>`),
    assert(ctx) {
      ctx.color(36, 16, '#000', 40)
      ctx.color(36, 28, '#fff')
    },
  },
  {
    id: 'shape.in-row',
    feature: '形状可以进 Row',
    source: scene(120, 40, `<Row cx="0" cy="0" anchor="top-left" style="gap:8px"><Rect id="a" width="18" height="10" fill="#000"/><Rect id="b" width="18" height="10" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.eq(ctx.byId('b').box.x, 26, 'b.x')
    },
  },
  {
    id: 'line.segment',
    feature: 'Line 用 Layer 坐标，不改去中心',
    source: scene(120, 60, `<Line x1="16" y1="24" x2="90" y2="24" stroke="#000" stroke-width="8"/>`),
    assert(ctx) {
      ctx.color(40, 24, '#000')
      ctx.color(40, 8, '#fff')
    },
  },
  {
    id: 'line.arrow',
    feature: 'Arrow 在终点画箭头',
    source: scene(140, 80, `<Arrow x1="20" y1="40" x2="100" y2="40" stroke="#000" stroke-width="6"/>`),
    assert(ctx) {
      ctx.color(50, 40, '#000')
      ctx.color(86, 34, '#000', 40)
      ctx.color(50, 10, '#fff')
    },
  },
  {
    id: 'line.polyline',
    feature: 'Polyline 按 points 折线',
    source: scene(100, 80, `<Polyline points="20,20 70,20 70,50" stroke="#000" stroke-width="8"/>`),
    assert(ctx) {
      ctx.color(40, 20, '#000')
      ctx.color(70, 36, '#000')
      ctx.color(40, 40, '#fff')
    },
  },
  {
    id: 'line.polygon-no-fill',
    feature: 'Polygon 默认不填充',
    source: scene(90, 70, `<Polygon points="20,16 60,16 60,48 20,48" stroke="#000" stroke-width="4"/>`),
    assert(ctx) {
      ctx.color(40, 32, '#fff')
      ctx.color(20, 32, '#000', 40)
    },
  },
  {
    id: 'line.path',
    feature: 'Path 的 d 画在 Layer 坐标上',
    source: scene(100, 70, `<Path d="M 16 36 H 84" stroke="#000" stroke-width="8"/>`),
    assert(ctx) {
      ctx.color(50, 36, '#000')
      ctx.color(50, 12, '#fff')
    },
  },
  {
    id: 'line.default-color',
    feature: '线条描边默认用全局 color',
    source: `<fvg width="100" height="40" background="#ffffff" color="#cc0000"><Line x1="10" y1="20" x2="80" y2="20" stroke-width="8"/></fvg>`,
    assert(ctx) {
      ctx.color(40, 20, '#cc0000', 16)
    },
  },
  {
    id: 'line.invalid-child',
    feature: '线条不能放进 Row',
    source: scene(80, 40, `<Row><Line x1="0" y1="0" x2="10" y2="10"/></Row>`),
    assert(ctx) {
      ctx.issue('invalid-child')
    },
  },
  {
    id: 'transform.scale-center',
    feature: '默认绕盒子中心缩放',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2"/>`),
    assert(ctx) {
      ctx.color(2, 20, '#000')
    },
  },
  {
    id: 'transform.scale-px-origin',
    feature: 'transform-origin 的像素钉住左上角',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2" transform-origin="0 0"/>`),
    assert(ctx) {
      ctx.color(2, 20, '#fff')
      ctx.color(16, 16, '#000')
    },
  },
  {
    id: 'transform.origin-keyword',
    feature: 'transform-origin 九宫格关键字',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2" transform-origin="top-left"/>`),
    assert(ctx) {
      ctx.color(2, 20, '#fff')
      ctx.color(16, 16, '#000')
    },
  },
  {
    id: 'transform.reject-percent',
    feature: 'transform-origin 不接受百分比',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2" transform-origin="50%"/>`),
    assert(ctx) {
      ctx.issue('invalid-attr')
      ctx.color(2, 20, '#000')
    },
  },
  {
    id: 'transform.reject-em',
    feature: 'transform-origin 不接受 em',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2" transform-origin="1em 2em"/>`),
    assert(ctx) {
      ctx.issue('invalid-attr')
      ctx.color(2, 20, '#000')
    },
  },
  {
    id: 'transform.style-overrides',
    feature: 'style 里的 transform-origin 盖过属性',
    source: scene(80, 80, `<Rect width="20" height="20" cx="10" cy="10" anchor="top-left" fill="#000" scale="2" transform-origin="center" style="transform-origin: 0px 0px"/>`),
    assert(ctx) {
      ctx.issue('invalid-attr', false)
      ctx.color(2, 20, '#fff')
      ctx.color(16, 16, '#000')
    },
  },
  {
    id: 'transform.rotate-box-stable',
    feature: '旋转不改变 box，ink 和像素跟着转',
    source: scene(100, 100, `<Rect id="r" width="40" height="10" cx="30" cy="40" anchor="top-left" fill="#000" rotate="90"/>`),
    assert(ctx) {
      const b = ctx.byId('r').box
      ctx.eq(b.x, 30, 'box.x')
      ctx.eq(b.y, 40, 'box.y')
      ctx.eq(b.width, 40, 'box.width')
      ctx.eq(b.height, 10, 'box.height')
      const ink = ctx.byId('r').ink
      if (ink.y + ink.height <= b.y + b.height + 1) ctx.fail('旋转后 ink 应该高出原盒子')
      ctx.color(50, 30, '#000')
      ctx.color(35, 45, '#fff')
    },
  },
  {
    id: 'transform.clock-hand',
    feature: 'anchor 与 transform-origin 同为 bottom 时绕底边中点转',
    source: scene(120, 80, `<Rect width="16" height="40" cx="50" cy="50" anchor="bottom" transform-origin="bottom" rotate="90" fill="#000"/>`),
    assert(ctx) {
      ctx.color(70, 50, '#000')
      ctx.color(50, 20, '#fff')
    },
  },
  {
    id: 'transform.layer-children',
    feature: 'Layer 旋转时子元素一起转',
    source: scene(100, 100, `<Layer width="40" height="10" cx="20" cy="20" anchor="top-left" rotate="90" transform-origin="0px 0px"><Rect width="40" height="10" cx="0" cy="0" anchor="top-left" fill="#000"/></Layer>`),
    assert(ctx) {
      ctx.color(15, 40, '#000')
      ctx.color(30, 40, '#fff')
    },
  },
  {
    id: 'paint.stack',
    feature: '后写的元素盖在上面',
    source: scene(80, 50, `<Rect width="30" height="24" cx="8" cy="10" anchor="top-left" fill="#ff0000"/><Rect width="30" height="24" cx="20" cy="10" anchor="top-left" fill="#0000ff"/>`),
    assert(ctx) {
      ctx.color(14, 20, '#ff0000', 12)
      ctx.color(28, 20, '#0000ff', 12)
    },
  },
  {
    id: 'paint.opacity',
    feature: 'opacity 和白底混合',
    source: scene(40, 40, `<Rect width="20" height="20" cx="8" cy="8" anchor="top-left" fill="#ff0000" opacity="0.5"/>`),
    assert(ctx) {
      ctx.color(16, 16, '#ff8080', 20)
    },
  },
  {
    id: 'paint.background',
    feature: '画布背景色',
    source: `<fvg width="20" height="20" background="#123456"></fvg>`,
    assert(ctx) {
      ctx.color(4, 4, '#123456', 2)
    },
  },
  {
    id: 'paint.transparent',
    feature: 'background=transparent 时空白处透明',
    source: `<fvg width="40" height="40" background="transparent"><Rect width="10" height="10" cx="20" cy="20" anchor="top-left" fill="#ff0000"/></fvg>`,
    assert(ctx) {
      ctx.alpha(2, 2, 0)
      ctx.color(24, 24, '#ff0000', 12)
    },
  },
  {
    id: 'report.overflow-canvas',
    feature: '着墨超出画布记 overflow-canvas，盒子仍按所写位置',
    source: scene(100, 60, `<Rect id="r" width="40" height="10" cx="90" cy="10" anchor="top-left" fill="#000"/>`),
    assert(ctx) {
      ctx.issue('overflow-canvas')
      ctx.eq(ctx.byId('r').box.x, 90, 'box.x')
    },
  },
  {
    id: 'report.outside-safe',
    feature: '文字贴边记 outside-safe',
    source: scene(200, 160, `<p id="t" cx="0" cy="40" anchor="top-left" style="font-size:32px">字</p>`),
    assert(ctx) {
      ctx.issue('outside-safe')
    },
  },
  {
    id: 'report.text-overflow',
    feature: '写死的宽高装不下文字时记 text-overflow',
    source: scene(200, 80, `<p id="t" style="width:20px; height:16px; white-space:nowrap; font-size:32px">比特币</p>`),
    assert(ctx) {
      ctx.issue('text-overflow')
    },
  },
  {
    id: 'report.flex-overflow',
    feature: '形状不被压扁，撑破 Row 时记 flex-overflow',
    source: scene(120, 40, `<Row id="row" cx="0" cy="0" anchor="top-left" style="width:40px"><Rect id="r" width="80" height="10" fill="#000"/></Row>`),
    assert(ctx) {
      ctx.issue('flex-overflow')
      ctx.eq(ctx.byId('r').box.width, 80, '形状宽度')
    },
  },
  {
    id: 'report.text-overlap',
    feature: '两段文字着墨重叠时记 text-overlap',
    source: scene(200, 120, `<p cx="100" cy="60">甲</p><p cx="100" cy="60">乙</p>`),
    assert(ctx) {
      ctx.issue('text-overlap')
    },
  },
  {
    id: 'report.min-font-size',
    feature: '字号过小记 min-font-size',
    source: `<fvg width="1080" height="200" background="#fff"><p cx="540" cy="100" style="font-size:12px">小</p></fvg>`,
    assert(ctx) {
      ctx.issue('min-font-size')
    },
  },
  {
    id: 'report.unknown-tag',
    feature: '不认识的标签忽略并警告',
    source: scene(40, 40, `<Foo id="x"/>`),
    assert(ctx) {
      ctx.issue('unknown-tag')
      ctx.noId('x')
    },
  },
]

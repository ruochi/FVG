import { describe, expect, it } from 'vitest'
import { h } from './h.js'
import { checkFvg } from './render.js'
import { posePoint, project } from './perspective.js'
import type { LayoutNode } from './types.js'

function node(partial: Partial<LayoutNode> & Pick<LayoutNode, 'kind'>): LayoutNode {
  return {
    path: 'Layer',
    tag: 'Layer',
    x: 0,
    y: 0,
    width: 80,
    height: 40,
    ink: { x: 0, y: 0, width: 80, height: 40 },
    opacity: 1,
    rotate: 0,
    scale: 1,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    attr: {},
    style: {},
    computed: { color: '#111', fontFamily: 'sans', fontSize: 16, fontWeight: 400, opacity: 1 },
    text: '',
    children: [],
    ...partial,
  } as LayoutNode
}

describe('perspective', () => {
  it('z 越大，点离灭点越远', () => {
    expect(project(100, 100, 200, { x: 150, y: 100, z: 0 })).toEqual({ x: 150, y: 100 })
    expect(project(100, 100, 200, { x: 150, y: 100, z: 100 })).toEqual({ x: 200, y: 100 })
    expect(project(100, 100, 200, { x: 150, y: 100, z: 200 })).toBeNull()
  })

  it('只有 rotate 和 scale 时，中心与角点和二维一致', () => {
    const box = node({ kind: 'shape', x: 10, y: 20, width: 80, height: 40, rotate: 90, scale: 2 })
    const center = posePoint(box, 40, 20)
    expect(center.x).toBeCloseTo(50)
    expect(center.y).toBeCloseTo(40)
    expect(center.z).toBeCloseTo(0)
    const corner = posePoint(box, 0, 0)
    // 绕中心转 90° 再放大 2：局部 (-40,-20) → (40,-80)，加回中心 (50,40)
    expect(corner.x).toBeCloseTo(90)
    expect(corner.y).toBeCloseTo(-40)
  })

  it('没有 perspective 时 rotateY 报 flatten-3d', async () => {
    const report = await checkFvg(
      h('Layer', { width: '100', height: '100' }, h('Rect', { cx: '50', cy: '50', width: '40', height: '40', rotateY: '20', fill: '#fff' })),
    )
    expect(report.issues.some((issue) => issue.code === 'flatten-3d')).toBe(true)
  })

  it('z 超过视距时报 behind-camera', async () => {
    const report = await checkFvg(
      h(
        'Layer',
        { width: '100', height: '100', perspective: '80' },
        h('Rect', { cx: '50', cy: '50', width: '20', height: '20', z: '80', fill: '#fff' }),
      ),
    )
    expect(report.issues.some((issue) => issue.code === 'behind-camera')).toBe(true)
  })
})

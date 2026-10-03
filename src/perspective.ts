import type { Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas'
import { originOffset } from './matrix.js'
import type { Issue, LayoutNode } from './types.js'

export type Vec3 = { x: number; y: number; z: number }
export type Vec2 = { x: number; y: number }

type Pose = {
  x: number
  y: number
  originX: number
  originY: number
  scale: number
  rotate: number
  rotateX: number
  rotateY: number
  z: number
}

function poseOf(node: LayoutNode): Pose {
  const o = originOffset(node.origin, node.width, node.height)
  return {
    x: node.x,
    y: node.y,
    originX: o.x,
    originY: o.y,
    scale: node.scale || 1,
    rotate: node.rotate || 0,
    rotateX: node.rotateX ?? 0,
    rotateY: node.rotateY ?? 0,
    z: node.z ?? 0,
  }
}

export function has3dPose(node: LayoutNode): boolean {
  return (node.rotateX ?? 0) !== 0 || (node.rotateY ?? 0) !== 0 || (node.z ?? 0) !== 0
}

/** 盒子局部 (u, v) 先缩放，再平移 z，再 rotateX、rotateY、rotate，回到父级坐标。z 朝观众。 */
export function posePoint(node: LayoutNode, u: number, v: number): Vec3 {
  const pose = poseOf(node)
  let x = (u - pose.originX) * pose.scale
  let y = (v - pose.originY) * pose.scale
  let z = pose.z
  const rx = (pose.rotateX * Math.PI) / 180
  const ry = (pose.rotateY * Math.PI) / 180
  const rz = (pose.rotate * Math.PI) / 180
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  const yx = y * cx - z * sx
  const zx = y * sx + z * cx
  const xy = x * cy + zx * sy
  const zy = -x * sy + zx * cy
  const xz = xy * cz - yx * sz
  const yz = xy * sz + yx * cz
  return { x: pose.x + pose.originX + xz, y: pose.y + pose.originY + yz, z: zy }
}

/** 视距像素。灭点 (vx, vy)。z 越大越近。观众身后返回 null。 */
export function project(vx: number, vy: number, perspective: number, p: Vec3): Vec2 | null {
  const w = 1 - p.z / perspective
  if (w <= 1e-4) return null
  return { x: vx + (p.x - vx) / w, y: vy + (p.y - vy) / w }
}

export function planeDepth(node: LayoutNode): number {
  return posePoint(node, node.width / 2, node.height / 2).z
}

function solveAffine(
  s0: Vec2,
  s1: Vec2,
  s2: Vec2,
  d0: Vec2,
  d1: Vec2,
  d2: Vec2,
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const det = s0.x * (s1.y - s2.y) - s0.y * (s1.x - s2.x) + (s1.x * s2.y - s2.x * s1.y)
  if (Math.abs(det) < 1e-8) return null
  const coeff = (u0: number, u1: number, u2: number) => {
    const a = (u0 * (s1.y - s2.y) - s0.y * (u1 - u2) + (u1 * s2.y - u2 * s1.y)) / det
    const c = (s0.x * (u1 - u2) - u0 * (s1.x - s2.x) + (s1.x * u2 - s2.x * u1)) / det
    const e = (s0.x * (s1.y * u2 - s2.y * u1) - s0.y * (s1.x * u2 - s2.x * u1) + u0 * (s1.x * s2.y - s2.x * s1.y)) / det
    return { a, c, e }
  }
  const x = coeff(d0.x, d1.x, d2.x)
  const y = coeff(d0.y, d1.y, d2.y)
  return { a: x.a, b: y.a, c: x.c, d: y.c, e: x.e, f: y.e }
}

function expandTriangle(points: [Vec2, Vec2, Vec2], amount: number): [Vec2, Vec2, Vec2] {
  const cx = (points[0].x + points[1].x + points[2].x) / 3
  const cy = (points[0].y + points[1].y + points[2].y) / 3
  return points.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount }
  }) as [Vec2, Vec2, Vec2]
}

function drawTriangle(
  ctx: CanvasRenderingContext2D & { drawImage(...args: unknown[]): void },
  bitmap: Canvas,
  logicalWidth: number,
  logicalHeight: number,
  s0: Vec2,
  s1: Vec2,
  s2: Vec2,
  d0: Vec2,
  d1: Vec2,
  d2: Vec2,
) {
  const m = solveAffine(s0, s1, s2, d0, d1, d2)
  if (!m) return
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.beginPath()
  ctx.moveTo(d0.x, d0.y)
  ctx.lineTo(d1.x, d1.y)
  ctx.lineTo(d2.x, d2.y)
  ctx.closePath()
  ctx.clip()
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f)
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, logicalWidth, logicalHeight)
  ctx.restore()
}

/** 把位图贴到投影后的平面上。网格点用真实投影，避免整张图只做一次仿射。 */
export function drawTexturedPlane(
  ctx: CanvasRenderingContext2D & { drawImage(...args: unknown[]): void },
  bitmap: Canvas,
  logicalWidth: number,
  logicalHeight: number,
  at: (u: number, v: number) => Vec2 | null,
) {
  const edge = Math.max(logicalWidth, logicalHeight)
  const n = Math.min(24, Math.max(4, Math.ceil(edge / 32)))
  const pts: Array<Vec2 | null> = []
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      pts.push(at((i / n) * logicalWidth, (j / n) * logicalHeight))
    }
  }
  const atGrid = (i: number, j: number) => pts[j * (n + 1) + i]!
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const d00 = atGrid(i, j)
      const d10 = atGrid(i + 1, j)
      const d11 = atGrid(i + 1, j + 1)
      const d01 = atGrid(i, j + 1)
      if (!d00 || !d10 || !d11 || !d01) continue
      const s00 = { x: (i / n) * logicalWidth, y: (j / n) * logicalHeight }
      const s10 = { x: ((i + 1) / n) * logicalWidth, y: (j / n) * logicalHeight }
      const s11 = { x: ((i + 1) / n) * logicalWidth, y: ((j + 1) / n) * logicalHeight }
      const s01 = { x: (i / n) * logicalWidth, y: ((j + 1) / n) * logicalHeight }
      // 裁剪边缘会露出底色，把目标三角形稍微撑开，相邻格叠上同一颜色。
      const [a, b, c] = expandTriangle([d00, d10, d11], 1.25)
      const [d, e, f] = expandTriangle([d00, d11, d01], 1.25)
      drawTriangle(ctx, bitmap, logicalWidth, logicalHeight, s00, s10, s11, a!, b!, c!)
      drawTriangle(ctx, bitmap, logicalWidth, logicalHeight, s00, s11, s01, d!, e!, f!)
    }
  }
}

/** 直接子级才进入这一层的镜头。再往里的子孙先画进父平面。 */
export function perspectiveIssues(root: LayoutNode): Issue[] {
  const issues: Issue[] = []
  const visit = (node: LayoutNode, inCamera: boolean, distance: number | undefined) => {
    if (has3dPose(node) && !inCamera) {
      issues.push({
        level: 'warn',
        code: 'flatten-3d',
        path: node.path,
        message: 'rotateX、rotateY、z 没有落在带 perspective 的 Layer 里',
        hint: '在父 Layer 上写 perspective，例如 <Layer perspective="900">',
      })
    }
    if (inCamera && distance != null && (node.z ?? 0) >= distance) {
      issues.push({
        level: 'warn',
        code: 'behind-camera',
        path: node.path,
        message: '平面在观众身后，不绘制',
        hint: `把 z 减小到小于 perspective（${distance}）`,
      })
    }
    const children = node.kind === 'layer' || node.kind === 'flex' ? node.children : []
    const opens = node.kind === 'layer' && node.perspective != null && node.perspective > 0
    for (const child of children) visit(child, opens, opens ? node.perspective : undefined)
  }
  visit(root, false, undefined)
  return issues
}

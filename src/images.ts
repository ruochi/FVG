import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { loadImage, type Image } from '@napi-rs/canvas'

export type FittedRect = {
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
}

export function getImagesCacheDir(): string {
  return join(homedir(), '.cache', 'fvg', 'images')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function download(url: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`图片下载失败 ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
}

export async function loadFvgImage(src: string, baseDir: string): Promise<{ image: Image; width: number; height: number }> {
  const trimmed = src.trim()
  if (!trimmed) throw new Error('图片地址为空')
  let path = trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    const hash = createHash('sha256').update(trimmed).digest('hex').slice(0, 16)
    const ext = trimmed.match(/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i)?.[1] ?? 'img'
    path = join(getImagesCacheDir(), `${hash}.${ext}`)
    if (!(await fileExists(path))) await download(trimmed, path)
  } else {
    path = isAbsolute(trimmed) ? trimmed : resolve(baseDir, trimmed)
    if (!(await fileExists(path))) throw new Error(`图片文件不存在: ${path}`)
  }
  const image = await loadImage(path)
  return { image, width: image.width, height: image.height }
}

/** `fill` 拉伸；`contain` 整图放进盒子；`cover` 裁切后铺满。 */
export function objectFitRect(
  fit: 'fill' | 'contain' | 'cover',
  iw: number,
  ih: number,
  bw: number,
  bh: number,
): FittedRect {
  if (iw <= 0 || ih <= 0 || bw <= 0 || bh <= 0 || fit === 'fill') {
    return { sx: 0, sy: 0, sw: iw, sh: ih, dx: 0, dy: 0, dw: bw, dh: bh }
  }
  const scale = fit === 'cover' ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih)
  if (fit === 'cover') {
    const sw = bw / scale
    const sh = bh / scale
    return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh, dx: 0, dy: 0, dw: bw, dh: bh }
  }
  const dw = iw * scale
  const dh = ih * scale
  return { sx: 0, sy: 0, sw: iw, sh: ih, dx: (bw - dw) / 2, dy: (bh - dh) / 2, dw, dh }
}

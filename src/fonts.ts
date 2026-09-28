import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GlobalFonts } from '@napi-rs/canvas'

export const DEFAULT_FONT_FAMILY = 'ChillDuanSans'
const DEFAULT_FONT_URL =
  'https://banling1.oss-cn-beijing.aliyuncs.com/weixin/dc/fonts/ChillDuanSansVF.ttf'
const DEFAULT_FONT_FILE = 'ChillDuanSansVF.ttf'

const registered = new Set<string>()

let cacheDirOverride: string | undefined

export function setFontsCacheDir(dir: string | undefined): void {
  cacheDirOverride = dir
}

export function getFontsCacheDir(): string {
  return cacheDirOverride ?? join(homedir(), '.cache', 'fvg', 'fonts')
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
  if (!res.ok) throw new Error(`字体下载失败 ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
}

export async function ensureDefaultFont(): Promise<string> {
  const cache = getFontsCacheDir()
  const dest = join(cache, DEFAULT_FONT_FILE)
  if (!(await fileExists(dest))) {
    await download(DEFAULT_FONT_URL, dest)
  }
  registerFontPath(DEFAULT_FONT_FAMILY, dest)
  return dest
}

export function registerFontPath(family: string, filePath: string): void {
  if (registered.has(family)) return
  GlobalFonts.registerFromPath(filePath, family)
  registered.add(family)
}

export async function resolveFontSrc(src: string, baseDir: string): Promise<string> {
  const trimmed = src.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const hash = createHash('sha256').update(trimmed).digest('hex').slice(0, 16)
    const ext = trimmed.match(/\.(ttf|otf|woff2?)(\?|$)/i)?.[1] ?? 'ttf'
    const dest = join(getFontsCacheDir(), `${hash}.${ext}`)
    if (!(await fileExists(dest))) await download(trimmed, dest)
    return dest
  }
  const local = isAbsolute(trimmed) ? trimmed : resolve(baseDir, trimmed)
  if (!(await fileExists(local))) throw new Error(`字体文件不存在: ${local}`)
  return local
}

export async function registerFontsFromDocument(
  fontNodes: Array<{ family: string; src: string }>,
  baseDir: string,
): Promise<void> {
  await ensureDefaultFont()
  for (const f of fontNodes) {
    const path = await resolveFontSrc(f.src, baseDir)
    registerFontPath(f.family, path)
  }
}

/** 仅 ChillDuanSans 使用元素字重，其它字体一律 normal（400） */
export function effectiveFontWeight(family: string, weight: number): number {
  const norm = family.trim().toLowerCase()
  if (norm === 'chillduansans' || norm.includes('chillduan')) return weight
  return 400
}

export function buildFontString(family: string, weight: number, sizePx: number): string {
  const w = effectiveFontWeight(family, weight)
  return `${w} ${sizePx}px ${family}, ${DEFAULT_FONT_FAMILY}, sans-serif`
}

/** 测量用：若默认字体未注册则尝试读缓存路径（测试可预先放入字体） */
export async function initFontsForMeasure(options?: { fontsCacheDir?: string }): Promise<boolean> {
  if (options?.fontsCacheDir) setFontsCacheDir(options.fontsCacheDir)
  const cache = getFontsCacheDir()
  const dest = join(cache, DEFAULT_FONT_FILE)
  if (await fileExists(dest)) {
    registerFontPath(DEFAULT_FONT_FAMILY, dest)
    return true
  }
  try {
    await ensureDefaultFont()
    return true
  } catch {
    return false
  }
}

export function packageDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

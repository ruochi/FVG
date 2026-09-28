import { createCanvas, loadImage } from '@napi-rs/canvas'

export type PixelView = {
  width: number
  height: number
  at(x: number, y: number): readonly [number, number, number, number]
}

export async function pixelsFromPng(png: Buffer): Promise<PixelView> {
  const img = await loadImage(png)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  return {
    width: img.width,
    height: img.height,
    at(x: number, y: number) {
      const i = (y * img.width + x) * 4
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const
    },
  }
}

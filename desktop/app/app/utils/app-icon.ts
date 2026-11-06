import type { ThemeChoice } from '~/utils/app-theme'
import { isFlavor, markStops } from '~/utils/app-theme'
import { PALETTES } from '~/utils/catppuccin'

/**
 * The app icon in a Catppuccin flavour: `desktop/app-icon.svg`'s M-check
 * mark, its stroke the accent's (`markStops`) on the flavour's darkest tone
 * (its lightest for Latte). Null for TrueMain: the shell puts the bundle's own
 * icon back.
 */
export function appIconSvg(choice: Pick<ThemeChoice, 'theme' | 'accent'>): string | null {
  if (!isFlavor(choice.theme)) return null
  const palette = PALETTES[choice.theme]
  const [top, middle, foot] = markStops(palette[choice.accent])
  const tile = choice.theme === 'latte' ? palette.base : palette.crust
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${middle}"/><stop offset="1" stop-color="${foot}"/></linearGradient></defs>`
    + `<rect width="64" height="64" fill="${tile}"/>`
    + `<path d="M16 48V22l14 16L48 16" fill="none" stroke="url(#g)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>`
    + `</svg>`
}

/** `svg` drawn on a `size`-pixel square. */
async function draw(svg: string, size: number): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d')!.drawImage(image, 0, 0, size, size)
  return canvas
}

/** The pixels the window, the taskbar and the tray take: a small square, raw RGBA (the shell decodes no image format for them). */
export const ICON_PIXELS = 128

/**
 * What the shell is handed (`set_app_icon`): a 512-pixel PNG for the Dock,
 * which AppKit decodes, and the `ICON_PIXELS` square as raw RGBA.
 */
export async function rasterizeIcon(svg: string): Promise<{ png: number[], rgba: number[], size: number }> {
  const big = await draw(svg, 512)
  const blob = await new Promise<Blob | null>(resolve => big.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('the icon could not be drawn')
  const small = await draw(svg, ICON_PIXELS)
  const pixels = small.getContext('2d')!.getImageData(0, 0, ICON_PIXELS, ICON_PIXELS).data
  return { png: Array.from(new Uint8Array(await blob.arrayBuffer())), rgba: Array.from(pixels), size: ICON_PIXELS }
}

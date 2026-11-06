import type { ThemeChoice } from '~/utils/app-theme'
import { isPaletteTheme, markStops } from '~/utils/app-theme'
import { themeDef } from '~/utils/themes'

/** A five-pointed star of radius `r` about (`x`, `y`), point up. */
function star(x: number, y: number, r: number, fill: string): string {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5
    const radius = index % 2 ? r * 0.4 : r
    return `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`
  })
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

/**
 * The app icon in a palette theme: `desktop/app-icon.svg`'s M-check mark, its
 * stroke the accent's (`markStops`) on the theme's darkest tone (its lightest
 * on a light theme) — or the theme's own tile and mark where it draws one (the
 * Soviet theme's gold on red, under a gold star), or its drawing in place of
 * the mark (Cinnamoroll's puppy on pink). Null for TrueMain: the shell puts the
 * bundle's own icon back.
 */
export function appIconSvg(choice: Pick<ThemeChoice, 'theme' | 'accent'>, rounded = false): string | null {
  if (!isPaletteTheme(choice.theme)) return null
  const def = themeDef(choice.theme)
  const own = def.icon && 'mark' in def.icon ? def.icon.mark : null
  const [top, middle, foot] = markStops(own ?? def.palette[choice.accent])
  const tile = def.icon?.tile ?? (def.light ? def.palette.base : def.palette.crust)
  // A drawing in place of the mark (Cinnamoroll's puppy); the mark, with a gold star where the theme gives it its colour (Soviet).
  const mark = def.icon && 'art' in def.icon ? def.icon.art : MARK_PATH + (own ? star(15, 11, 6.5, own) : '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${middle}"/><stop offset="1" stop-color="${foot}"/></linearGradient></defs>`
    + (rounded
      // Apple's icon grid: the tile 824 of 1024, centred, its corners about 22.5 % of its side — the shape the Dock gives the bundle's icon.
      ? `<g transform="translate(6.25 6.25) scale(0.8047)"><rect width="64" height="64" rx="14.4" fill="${tile}"/>${mark}</g>`
      : `<rect width="64" height="64" fill="${tile}"/>${mark}`)
    + `</svg>`
}

const MARK_PATH = `<path d="M16 48V22l14 16L48 16" fill="none" stroke="url(#g)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>`

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
 * which AppKit decodes — `dockSvg`, rounded: macOS masks only the bundle's own icon —, and the `ICON_PIXELS` square as raw RGBA.
 */
export async function rasterizeIcon(svg: string, dockSvg = svg): Promise<{ png: number[], rgba: number[], size: number }> {
  const big = await draw(dockSvg, 512)
  const blob = await new Promise<Blob | null>(resolve => big.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('the icon could not be drawn')
  const small = await draw(svg, ICON_PIXELS)
  const pixels = small.getContext('2d')!.getImageData(0, 0, ICON_PIXELS, ICON_PIXELS).data
  return { png: Array.from(new Uint8Array(await blob.arrayBuffer())), rgba: Array.from(pixels), size: ICON_PIXELS }
}

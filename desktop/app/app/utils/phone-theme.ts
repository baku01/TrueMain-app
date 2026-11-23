/**
 * The theme the phone draws in (`mobile/…/ui/theme`): the app's tokens as the
 * page resolved them, sent to the shell (`phone_link_set_theme`), which hands
 * them to paired phones. Read off the page rather than computed from the
 * theme's definition, so TrueMain's own theme, light or dark, and every
 * palette theme with its accent reach the phone through one path.
 */

/** Token → the name the phone reads it by. */
export const PHONE_TOKENS = {
  'bg': '--ui-bg',
  'bgMuted': '--ui-bg-muted',
  'bgElevated': '--ui-bg-elevated',
  'bgAccented': '--ui-bg-accented',
  'pane': '--tm-pane',
  'pane2': '--tm-pane-2',
  'border': '--ui-border',
  'borderAccented': '--ui-border-accented',
  'primary': '--ui-primary',
  'textInverted': '--ui-text-inverted',
  'text': '--ui-text',
  'textHighlighted': '--ui-text-highlighted',
  'textToned': '--ui-text-toned',
  'textMuted': '--ui-text-muted',
  'textDimmed': '--ui-text-dimmed',
  'success': '--ui-success',
  'warning': '--ui-warning',
  'error': '--ui-error',
  'gold': '--color-gold',
  'dataGood': '--color-data-good',
  'dataMid': '--color-data-mid',
  'dataBad': '--color-data-bad',
  'ally': '--color-ally',
  'enemy': '--color-enemy',
  'tierS': '--color-tier-s',
  'tierA': '--color-tier-a',
  'tierB': '--color-tier-b',
  'tierC': '--color-tier-c',
  'tierD': '--color-tier-d',
} as const

export interface PhoneTheme {
  /** The theme's id (`truemain`, `mocha`…), for the phone to remember. */
  theme: string
  light: boolean
  /** `#rrggbb` per token; a token the page does not define is left out. */
  colors: Partial<Record<keyof typeof PHONE_TOKENS, string>>
}

const hex = (n: number) => n.toString(16).padStart(2, '0')

/**
 * Any CSS colour as `#rrggbb`, by painting it: the page's tokens are written
 * in `oklch()`, `color-mix()` and `var()`, which only the engine resolves.
 * Translucent colours are laid over `under` as they show.
 */
function toHex(context: CanvasRenderingContext2D, color: string, under: string): string | null {
  if (!color.trim()) return null
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = under
  context.fillRect(0, 0, 1, 1)
  // A colour the canvas cannot read leaves `fillStyle` as it was: a sentinel, read back as the canvas wrote it.
  context.fillStyle = '#010203'
  const sentinel = context.fillStyle
  context.fillStyle = color
  if (context.fillStyle === sentinel) return null
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `#${hex(r!)}${hex(g!)}${hex(b!)}`
}

export function readPhoneTheme(theme: string, light: boolean): PhoneTheme | null {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  // A probe element resolves `var()` chains the way the page does.
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const resolve = (token: string) => {
    probe.style.color = `var(${token})`
    return getComputedStyle(probe).color
  }
  const bg = toHex(context, resolve('--ui-bg'), '#000000') ?? (light ? '#ffffff' : '#000000')
  const colors: PhoneTheme['colors'] = {}
  for (const [name, token] of Object.entries(PHONE_TOKENS) as [keyof typeof PHONE_TOKENS, string][]) {
    if (!getComputedStyle(document.documentElement).getPropertyValue(token).trim()) continue
    const value = toHex(context, resolve(token), bg)
    if (value) colors[name] = value
  }
  probe.remove()
  return { theme, light, colors }
}

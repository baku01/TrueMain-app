/** The shapes of the shell's Riot-key commands (`src-tauri/src/riot.rs`). */
export type KeyCheckState = 'valid' | 'invalid' | 'forbidden' | 'rate-limited' | 'offline' | 'error'

export interface RateWindow {
  seconds: number
  limit: number
  used: number | null
}

export interface KeyCheck {
  state: KeyCheckState
  status: number | null
  platform: string
  appLimits: RateWindow[]
  methodLimits: RateWindow[]
  retryAfter: number | null
}

export interface KeyStatus {
  saved: boolean
  masked: string | null
}

/** Riot's platforms, as the subdomain of `api.riotgames.com`, with the name players know. */
export const PLATFORMS: { value: string, label: string }[] = [
  { value: 'br1', label: 'Brasil (BR)' },
  { value: 'na1', label: 'América do Norte (NA)' },
  { value: 'la1', label: 'América Latina Norte (LAN)' },
  { value: 'la2', label: 'América Latina Sul (LAS)' },
  { value: 'euw1', label: 'Europa Oeste (EUW)' },
  { value: 'eun1', label: 'Europa Nórdica e Leste (EUNE)' },
  { value: 'tr1', label: 'Turquia (TR)' },
  { value: 'ru', label: 'Rússia (RU)' },
  { value: 'me1', label: 'Oriente Médio (ME)' },
  { value: 'kr', label: 'Coreia (KR)' },
  { value: 'jp1', label: 'Japão (JP)' },
  { value: 'oc1', label: 'Oceania (OCE)' },
  { value: 'ph2', label: 'Filipinas (PH)' },
  { value: 'sg2', label: 'Singapura (SG)' },
  { value: 'th2', label: 'Tailândia (TH)' },
  { value: 'tw2', label: 'Taiwan (TW)' },
  { value: 'vn2', label: 'Vietnã (VN)' },
]

/** Requests per minute a window allows if it is spent evenly — what makes `100 per 2 minutes` comparable to `20 per second`. */
export function perMinute(window: RateWindow): number {
  return Math.round((window.limit / window.seconds) * 60)
}

/** The sustained budget: the slowest of the windows, per minute. That is the one that gates a long collection. */
export function sustainedPerMinute(windows: RateWindow[]): number | null {
  return windows.length ? Math.min(...windows.map(perMinute)) : null
}

/** `1 s`, `2 min`, `10 min`, `1 h` — a window's length as a person reads it. */
export function windowLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${seconds / 60} min`
  return `${seconds / 3600} h`
}

/**
 * What the limits say about the key. Riot gives no "key type" field: a
 * development or personal key is the 20/s + 100/2 min budget, anything above is
 * an approved product's. Said as what the numbers suggest, not as a fact.
 */
export function keyKind(windows: RateWindow[]): 'personal' | 'production' | null {
  if (windows.length === 0) return null
  const sustained = Math.min(...windows.map(window => window.limit / window.seconds))
  return sustained <= 1 ? 'personal' : 'production'
}

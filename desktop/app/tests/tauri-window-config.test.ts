import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `tauri.macos.conf.json` replaces the base config's `windows` array whole
 * (Tauri merges platform files by RFC 7396, and an array is a value of its
 * own), so the macOS window must restate every key of the base one — its zoom
 * shortcuts went missing so once.
 */
const read = (file: string) => JSON.parse(readFileSync(resolve(__dirname, '../../src-tauri', file), 'utf8'))

/** The keys macOS sets apart on purpose: a window clear to the system's material behind it (vibrancy). */
const MAC_OWN: Record<string, unknown> = { backgroundColor: '#00000000' }

describe('the macOS window config', () => {
  it('restates every key of the base window, with the same value — but those macOS sets apart', () => {
    const base = read('tauri.conf.json').app.windows[0] as Record<string, unknown>
    const mac = read('tauri.macos.conf.json').app.windows[0] as Record<string, unknown>
    for (const [key, value] of Object.entries(base)) expect(mac[key], key).toEqual(key in MAC_OWN ? MAC_OWN[key] : value)
  })

  it('is transparent over the sidebar\'s material, following the window\'s focus', () => {
    const mac = read('tauri.macos.conf.json').app.windows[0] as Record<string, unknown>
    expect(mac.transparent).toBe(true)
    expect(mac.windowEffects).toEqual({ effects: ['sidebar'], state: 'followsWindowActiveState' })
  })
})

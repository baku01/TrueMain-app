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

describe('the macOS window config', () => {
  it('restates every key of the base window, with the same value', () => {
    const base = read('tauri.conf.json').app.windows[0] as Record<string, unknown>
    const mac = read('tauri.macos.conf.json').app.windows[0] as Record<string, unknown>
    for (const [key, value] of Object.entries(base)) expect(mac[key], key).toEqual(value)
  })
})

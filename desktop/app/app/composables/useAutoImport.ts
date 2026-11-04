/**
 * Automatic import (Settings): what the draft writes into the client on its
 * own once the player locks a champion — the rune page, the item set and the
 * summoner spells — the way Blitz, OP.GG or U.GG do. Off until the player
 * turns it on, each part on its own switch; the writes themselves are the
 * import buttons' (`useRuneImport`, `useItemSetImport`, `useKitImport`), with
 * their rules: only TrueMain's own rune page and item set are ever replaced,
 * and the player can change anything afterwards.
 */
export interface AutoImportSettings {
  runes: boolean
  items: boolean
  spells: boolean
  /** The key Flash goes on, as the player plays it. */
  flash: 'D' | 'F'
}

const STORAGE_KEY = 'truemain-auto-import'
const DEFAULTS: AutoImportSettings = { runes: false, items: false, spells: false, flash: 'D' }

function stored(): AutoImportSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) as Partial<AutoImportSettings> } : { ...DEFAULTS }
  }
  catch {
    return { ...DEFAULTS }
  }
}

export function useAutoImport() {
  const settings = useState<AutoImportSettings>('auto-import', stored)
  function update(patch: Partial<AutoImportSettings>) {
    settings.value = { ...settings.value, ...patch }
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }
  const enabled = computed(() => settings.value.runes || settings.value.items || settings.value.spells)
  return { settings: readonly(settings), enabled, update }
}

/** Flash's Data Dragon key. */
const FLASH = 4

/** The two spells in the order the player wants them: Flash on their key. */
export function spellsInOrder(spell1Id: number, spell2Id: number, flash: 'D' | 'F'): [number, number] {
  if (flash === 'D' && spell2Id === FLASH) return [spell2Id, spell1Id]
  if (flash === 'F' && spell1Id === FLASH) return [spell2Id, spell1Id]
  return [spell1Id, spell2Id]
}

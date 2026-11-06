import type { PresetKey, WeightKey, WeightSettings } from '~/utils/draft-weights'
import { DEFAULT_SETTINGS, PRESETS, masteryFloor, presetOf, rebalanced, settingsOf } from '~/utils/draft-weights'

/**
 * The player's suggestion weights (`utils/draft-weights`), kept across
 * launches as the automatic import's switches are (`useAutoImport`): one
 * state for every screen, written back on each change.
 */
const STORAGE_KEY = 'truemain-suggestion-weights'

function stored(): WeightSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    return raw ? settingsOf(JSON.parse(raw)) : settingsOf(DEFAULT_SETTINGS)
  }
  catch {
    return settingsOf(DEFAULT_SETTINGS)
  }
}

export function useSuggestionWeights() {
  const settings = useState<WeightSettings>('suggestion-weights', stored)

  function save(next: WeightSettings) {
    settings.value = settingsOf(next)
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    }
    catch {
      // Storage unavailable: the weights hold until the window closes.
    }
  }

  /** The preset the weights match, or null for the player's own mix ("Custom"). */
  const preset = computed(() => presetOf(settings.value))

  return {
    settings: readonly(settings),
    preset,
    setWeight: (key: WeightKey, value: number) => save({ ...settings.value, weights: rebalanced(settings.value.weights, key, value) }),
    applyPreset: (key: PresetKey) => save({ weights: { ...PRESETS[key].weights }, minMastery: PRESETS[key].minMastery }),
    setMinMastery: (value: number) => save({ ...settings.value, minMastery: masteryFloor(value) }),
    reset: () => save(DEFAULT_SETTINGS),
  }
}

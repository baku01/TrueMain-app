import type { Tip } from '~/utils/tips/catalogue'
import type { ClipIndex } from '~/utils/tips/voice'
import { voicePlan } from '~/utils/tips/voice'
import { clipBlob, getPack } from '~/utils/tips/voice-store'

/**
 * Play clips of a pack one after the other, each through an object URL in an
 * `HTMLAudioElement` at `volume`; stops, between clips or in one, when
 * `signal` aborts. A clip that will not play ends the line, silently.
 */
export async function playClips(ids: string[], volume: number, signal: AbortSignal) {
  for (const id of ids) {
    if (signal.aborted) return
    const blob = await clipBlob(id)
    if (!blob || signal.aborted) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.volume = Math.min(1, Math.max(0, volume))
    try {
      await new Promise<void>((resolve, reject) => {
        const stop = () => {
          audio.pause()
          resolve()
        }
        signal.addEventListener('abort', stop, { once: true })
        audio.onended = () => {
          signal.removeEventListener('abort', stop)
          resolve()
        }
        audio.onerror = () => reject(audio.error)
        audio.play().catch(reject)
      })
    }
    catch {
      return
    }
    finally {
      URL.revokeObjectURL(url)
    }
  }
}

/**
 * The tips' voice: the selected pack's clips for a tip, when the pack has
 * them — and nothing otherwise, the text being there either way. One line
 * at a time: a new one cuts the last short.
 */
export function useTipVoice() {
  const { settings } = useTipSettings()
  const clips = shallowRef<ClipIndex | null>(null)
  let playing: AbortController | null = null

  // The pack's index only; each clip is read from the store when it is said.
  watch(() => settings.value.pack, async (id) => {
    clips.value = null
    if (!id) return
    try {
      clips.value = (await getPack(id))?.clips ?? null
    }
    catch {
      // No store in this webview: text only.
    }
  }, { immediate: true })

  function stop() {
    playing?.abort()
    playing = null
  }

  /** Say `tip` with `index`'s clips — the selected pack's unless another is given (the settings' test). */
  async function say(tip: Tip, index: ClipIndex | null = clips.value) {
    stop()
    const plan = index ? voicePlan(tip.key, tip.params, index) : []
    if (!plan.length) return false
    const current = new AbortController()
    playing = current
    await playClips(plan, settings.value.volume, current.signal)
    return true
  }

  onScopeDispose(stop)
  return { say, stop }
}

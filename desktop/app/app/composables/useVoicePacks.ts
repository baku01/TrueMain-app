import { tr } from '#common/utils/i18n'
import type { TipKey } from '~/utils/tips/catalogue'
import type { PackRefusal } from '~/utils/tips/voice-pack'
import type { VoicePack } from '~/utils/tips/voice-store'
import { SAMPLE_PARAMS, TIP_KEYS, makeTip } from '~/utils/tips/catalogue'
import { voicePlan } from '~/utils/tips/voice'
import { MAX_PACK_BYTES, VoicePackError, readVoicePack } from '~/utils/tips/voice-pack'
import { deletePack, listPacks, savePack } from '~/utils/tips/voice-store'
import { voicePackTemplate } from '~/utils/tips/voice-template'

/** Why a pack was refused, for the toast; `store` when the webview would not keep it. */
const REFUSALS: Record<PackRefusal | 'store', string> = {
  notZip: 'tips.voice.refused.notZip',
  tooLarge: 'tips.voice.refused.tooLarge',
  empty: 'tips.voice.refused.empty',
  store: 'tips.voice.refused.store',
}

/**
 * The voice packs, for the Overlay page: the ones imported, and importing,
 * choosing, trying and removing one. A pack is read and checked whole
 * (`readVoicePack`) before any of it is kept; the first one imported is
 * chosen, so a player who imports one hears it.
 */
export function useVoicePacks() {
  const packs = useState<VoicePack[]>('voice-packs', () => [])
  const busy = ref(false)
  const toast = useToast()
  const { settings, update } = useTipSettings()
  const voice = useTipVoice()

  async function refresh() {
    try {
      packs.value = await listPacks()
    }
    catch {
      packs.value = []
    }
  }
  onMounted(refresh)

  async function importFile(file: File) {
    busy.value = true
    try {
      if (file.size > MAX_PACK_BYTES) throw new VoicePackError('tooLarge')
      const read = readVoicePack(new Uint8Array(await file.arrayBuffer()), file.name)
      const pack = await savePack(read)
      await refresh()
      if (!settings.value.pack) update({ pack: pack.id })
      toast.add({
        title: tr('tips.voice.imported', { name: pack.name }),
        description: tr('tips.voice.importedDetail', { clips: read.clips.length, ignored: read.ignored.length }),
        icon: 'i-lucide-audio-lines',
        color: 'success',
      })
    }
    catch (error) {
      const reason = error instanceof VoicePackError ? error.reason : 'store'
      toast.add({ title: tr('tips.voice.importFailed'), description: tr(REFUSALS[reason]), icon: 'i-lucide-file-x', color: 'error' })
    }
    finally {
      busy.value = false
    }
  }

  async function remove(pack: VoicePack) {
    try {
      await deletePack(pack.id)
    }
    finally {
      if (settings.value.pack === pack.id) update({ pack: null })
      await refresh()
    }
  }

  const select = (id: string | null) => update({ pack: id })

  /** Say the first tip `pack` can voice, with made-up names and numbers. */
  async function test(pack: VoicePack) {
    const key = TIP_KEYS.find((tip: TipKey) => voicePlan(tip, SAMPLE_PARAMS, pack.clips).length > 0)
    if (key) await voice.say(makeTip(key, SAMPLE_PARAMS), pack.clips)
  }

  /** Hand out the template ZIP: a manifest to fill and the list of what to record. */
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([voicePackTemplate() as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'truemain-pacote-de-voz-modelo.zip'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return { packs, busy, importFile, remove, select, test, downloadTemplate }
}

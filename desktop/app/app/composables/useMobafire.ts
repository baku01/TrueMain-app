import type { ShallowRef } from 'vue'
import type { Guide, GuideChampion, GuideFilters, GuideList } from '~/utils/mobafire'
import { getActiveLocale } from '#common/utils/i18n'
import { guidePath, isBlockedPage, listPath, parseGuide, parseGuideList } from '~/utils/mobafire'
import type { GuideIndex } from '~/utils/guide-entities'
import { guideIndex } from '~/utils/guide-entities'
import { translateGuide, translateList } from '~/utils/guide-translate'
import { translationTarget } from '~/utils/translate'

/** How long a read page is kept: a list moves with every guide updated, a guide only when its author edits it. */
const LIST_TTL_MS = 10 * 60 * 1000
const GUIDE_TTL_MS = 30 * 60 * 1000

type Status = 'idle' | 'loading' | 'ready' | 'error'

const pages = new Map<string, { at: number, html: Promise<string> }>()

/** How long the dev server's proxy is given; the shell keeps its own limits. */
const DEV_TIMEOUT_MS = 60_000

/**
 * One MOBAFire page's HTML. In the app the shell reads it in its MOBAFire
 * window — Cloudflare lets no plain HTTP client through (`src-tauri/src/
 * mobafire.rs`); in a browser `npm run dev` asks the dev server's
 * `/__mobafire` proxy. Kept a while, a failed read forgotten at once; `fresh`
 * reads it again whatever is kept.
 */
function readPage(path: string, ttl: number, fresh = false): Promise<string> {
  const kept = pages.get(path)
  if (kept && !fresh && Date.now() - kept.at < ttl) return kept.html
  const html = (async () => {
    const page = insideTauri()
      ? await (await import('@tauri-apps/api/core')).invoke<string>('mobafire_page', { path })
      : await $fetch<string>(`/__mobafire/${path}`, { responseType: 'text', timeout: DEV_TIMEOUT_MS })
    if (isBlockedPage(page)) throw new Error('MOBAFire refused the visit')
    return page
  })()
  pages.set(path, { at: Date.now(), html })
  html.catch(() => {
    if (pages.get(path)?.html === html) pages.delete(path)
  })
  return html
}

/**
 * Whether MOBAFire's window is up asking the player to confirm they are human
 * (Cloudflare's check, `mobafire://check`): the guides page says so while it
 * waits, rather than seeming stuck.
 */
export function useMobafireCheck() {
  const checking = useState('mobafire-check', () => false)
  let stop: (() => void) | null = null
  let gone = false
  onMounted(async () => {
    if (!insideTauri()) return
    const { listen } = await import('@tauri-apps/api/event')
    const unlisten = await listen<boolean>('mobafire://check', event => (checking.value = event.payload))
    if (gone) unlisten()
    else stop = unlisten
  })
  onBeforeUnmount(() => {
    gone = true
    stop?.()
  })
  return checking
}

/**
 * What people wrote on MOBAFire, in the app's language (`utils/guide-translate`):
 * whether it shows translated — the player can read the original instead,
 * for every page at once — and whether a translation is on its way.
 */
export function useGuideTranslation() {
  const original = useState('mobafire-original', () => false)
  const target = computed(() => translationTarget(getActiveLocale()))
  return { original, target }
}

/**
 * A page's content as read, then — when the app's language is not English —
 * as translated: the original shows at once, the translation replaces it as
 * it comes, and a failed translation leaves the original.
 */
function useTranslated<T>(translate: (value: T, target: string) => Promise<T>) {
  const { original, target } = useGuideTranslation()
  const read: ShallowRef<T | null> = shallowRef(null)
  const translated: ShallowRef<T | null> = shallowRef(null)
  const translating = ref(false)
  let latest = 0
  watch([read, target], async () => {
    const turn = ++latest
    const value = read.value
    const language = target.value
    translated.value = null
    if (!value || !language) return
    translating.value = true
    try {
      const answer = await translate(value, language)
      if (turn === latest) translated.value = answer
    }
    catch {
      // The original stays.
    }
    finally {
      if (turn === latest) translating.value = false
    }
  })
  const shown = computed<T | null>(() => (original.value ? read.value : translated.value ?? read.value))
  return { read, shown, translating: computed(() => translating.value && !original.value), translatable: computed(() => !!target.value) }
}

/** The guide list for `filters`, read again as they change; the site's champions kept from the first list read. */
export function useGuideList(filters: Ref<GuideFilters>) {
  const { read: list, shown, translating, translatable } = useTranslated<GuideList>(translateList)
  const status = ref<Status>('idle')
  const champions = useState<GuideChampion[]>('mobafire-champions', () => [])
  let latest = 0

  async function load(fresh = false) {
    const read = ++latest
    status.value = 'loading'
    try {
      const answer = parseGuideList(await readPage(listPath(filters.value), LIST_TTL_MS, fresh))
      if (read !== latest) return
      list.value = answer
      if (answer.champions.length) champions.value = answer.champions
      status.value = 'ready'
    }
    catch {
      if (read === latest) status.value = 'error'
    }
  }

  watch(() => listPath(filters.value), () => load(), { immediate: true })
  return { list: shown, status, champions, translating, translatable, reload: () => load(true) }
}

/** One guide, by its slug; null for a slug that is no guide's. */
export function useGuide(slug: Ref<string>) {
  const { read: guide, shown, translating, translatable } = useTranslated<Guide>(translateGuide)
  const status = ref<Status>('idle')
  let latest = 0

  async function load(fresh = false) {
    const read = ++latest
    const path = guidePath(slug.value)
    guide.value = null
    if (!path) {
      status.value = 'error'
      return
    }
    status.value = 'loading'
    try {
      const answer = parseGuide(await readPage(path, GUIDE_TTL_MS, fresh), slug.value)
      if (read !== latest) return
      guide.value = answer
      status.value = 'ready'
    }
    catch {
      if (read === latest) status.value = 'error'
    }
  }

  watch(slug, () => load(), { immediate: true })
  return { guide: shown, status, translating, translatable, reload: () => load(true) }
}

/** The game's ids for what guides name in English (`utils/guide-entities`), for the patch the app reads; null until read. */
export function useGuideIndex() {
  const { patch } = useChampionStatics()
  const index = shallowRef<GuideIndex | null>(null)
  watch(patch, async (version) => {
    if (version) index.value = await guideIndex(version).catch(() => null)
  }, { immediate: true })
  return index
}

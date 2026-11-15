import type { ShallowRef } from 'vue'
import type { Guide, GuideChampion, GuideFilters, GuideList } from '~/utils/mobafire'
import { ddragonLocale, getActiveLocale } from '#common/utils/i18n'
import { guidePath, isBlockedPage, listPath, parseGuide, parseGuideList } from '~/utils/mobafire'
import type { GuideIndex } from '~/utils/guide-entities'
import { guideIndex, localRuneNames, nameKey } from '~/utils/guide-entities'
import type { TermProtection } from '~/utils/guide-translate'
import { NO_PROTECTION, translateGuide, translateList } from '~/utils/guide-translate'
import type { LexiconAbility, LexiconEntry } from '~/utils/guide-terms'
import { guideLexicon } from '~/utils/guide-terms'
import { englishChampion } from '~/utils/guide-art'
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
 * the language the service is asked for, null when the app's is English and
 * the guides show as written.
 */
export function useGuideTranslation() {
  const target = computed(() => translationTarget(getActiveLocale()))
  return { target }
}

/** How long a translation waits for the app's data before it goes with what has come. */
const DATA_WAIT_MS = 8000

/** `read`'s value once it has one, or null after `ms`. */
function settled<T>(read: () => T | null | undefined | false, ms: number): Promise<T | null> {
  const now = read()
  if (now) return Promise.resolve(now)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop()
      resolve(null)
    }, ms)
    const stop = watch(read, (value) => {
      if (!value) return
      clearTimeout(timer)
      stop()
      resolve(value)
    })
  })
}

/**
 * What a translation keeps from the translator (`utils/guide-terms`): the
 * game's words the index knows in English and the guide champion's
 * abilities, with each thing's name in the player's language from the app's
 * own data — its items, summoner spells and champions, Data Dragon's rune
 * names, the champion's file. It waits a while for that data (a guide is
 * read in about as long); whatever has not come by then keeps its English
 * name, and without the index the translation protects the ability keys alone.
 */
function useTermProtection(lite = false) {
  const { patch, aliasOf, champions } = useChampionStatics()
  // The list's titles name champions and little else: its translation leaves the
  // app's items and spells unread, rather than read them for a list.
  const data = lite ? null : useStaticData()
  return async (championName: string | null): Promise<TermProtection> => {
    try {
      const version = await settled(() => patch.value, DATA_WAIT_MS)
      if (!version) return NO_PROTECTION
      const index = await guideIndex(version)
      const championId = championName ? index.champions.get(nameKey(championName)) ?? null : null
      const alias = championId ? aliasOf(championId) : null
      const [english, runes] = await Promise.all([
        alias ? englishChampion(version, alias).catch(() => null) : null,
        localRuneNames(version, ddragonLocale(getActiveLocale())).catch(() => new Map<number, string>()),
        championId ? data?.loadChampion(championId) : null,
        data ? settled(() => !data.pending.value, DATA_WAIT_MS) : null,
      ])
      const abilities: LexiconAbility[] = english
        ? [...(english.passive ? [{ name: english.passive.name, key: 'P' }] : []), ...english.spells.slice(0, 4).map((spell, at) => ({ name: spell.name, key: 'QWER'[at]! }))]
        : []
      const local = (entry: LexiconEntry): string | null => {
        const id = entry.id ?? -1
        switch (entry.kind) {
          case 'item': return data?.items.value[id]?.name ?? null
          case 'spell': return data?.summoners.value[id]?.name ?? null
          case 'rune':
          case 'style': return runes.get(id) ?? null
          case 'champion': return champions.value.get(id)?.name ?? null
          case 'ability': return championId && entry.key ? data?.championStatic(championId)?.championSpells[entry.key]?.name ?? null : null
          default: return null
        }
      }
      return { lexicon: guideLexicon(index.terms ?? [], abilities), local }
    }
    catch {
      return NO_PROTECTION
    }
  }
}

/**
 * A page's content as read, then — when the app's language is not English —
 * as translated: the original shows at once, the translation replaces it as
 * it comes, and a failed translation leaves the original. There is no going
 * back to the original: a player who reads the app in their language reads
 * the guides in it too.
 */
function useTranslated<T>(translate: (value: T, target: string) => Promise<T>) {
  const { target } = useGuideTranslation()
  const read: ShallowRef<T | null> = shallowRef(null)
  const translated: ShallowRef<T | null> = shallowRef(null)
  const translating = ref(false)
  let latest = 0
  watch([read, target], async () => {
    const turn = ++latest
    const value = read.value
    const language = target.value
    translated.value = null
    if (!value || !language) {
      translating.value = false
      return
    }
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
  const shown = computed<T | null>(() => translated.value ?? read.value)
  return { read, shown, translating: computed(() => translating.value) }
}

/** The guide list for `filters`, read again as they change; the site's champions kept from the first list read. */
export function useGuideList(filters: Ref<GuideFilters>) {
  const protection = useTermProtection(true)
  const { read: list, shown, translating } = useTranslated<GuideList>(async (value, target) => translateList(value, target, await protection(null)))
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
  return { list: shown, status, champions, translating, reload: () => load(true) }
}

/** One guide, by its slug; null for a slug that is no guide's. */
export function useGuide(slug: Ref<string>) {
  const protection = useTermProtection()
  const { read: guide, shown, translating } = useTranslated<Guide>(async (value, target) => translateGuide(value, target, await protection(value.champion)))
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
  return { guide: shown, status, translating, reload: () => load(true) }
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

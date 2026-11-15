import type { Guide, GuideChampion, GuideFilters, GuideList } from '~/utils/mobafire'
import { guidePath, isBlockedPage, listPath, parseGuide, parseGuideList } from '~/utils/mobafire'

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

/** The guide list for `filters`, read again as they change; the site's champions kept from the first list read. */
export function useGuideList(filters: Ref<GuideFilters>) {
  const list = shallowRef<GuideList | null>(null)
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
  return { list, status, champions, reload: () => load(true) }
}

/** One guide, by its slug; null for a slug that is no guide's. */
export function useGuide(slug: Ref<string>) {
  const guide = shallowRef<Guide | null>(null)
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
  return { guide, status, reload: () => load(true) }
}

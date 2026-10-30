import { getActiveLocale } from '#common/utils/i18n'
import type { PatchNote, PatchSummary } from '~/utils/patch-notes'
import { parsePatchList, parsePatchNote } from '~/utils/patch-notes'

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/

/** How long a list is trusted: a patch lands every two weeks, and an open page checks twice an hour. */
const REFRESH_MS = 30 * 60 * 1000

type Status = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Riot's patch notes, kept live: the list of patches is read when the page
 * opens, again whenever the window comes back to the front after a while, and
 * every half hour it stays open, so a patch published today shows up without
 * a restart. One patch's note is read when it is picked, and kept for the
 * session. In the app the shell fetches the pages (the site sends no CORS
 * header, `src-tauri/src/news.rs`); in a browser `npm run dev` goes through the
 * dev server's `/__riot` proxy instead.
 */
export function usePatchNotes() {
  const list = useState<PatchSummary[]>('patchnotes-list', () => [])
  const listStatus = useState<Status>('patchnotes-list-status', () => 'idle')
  const updatedAt = useState<number>('patchnotes-updated-at', () => 0)
  const notes = useState<Record<string, PatchNote>>('patchnotes-notes', () => ({}))
  const noteStatus = useState<Status>('patchnotes-note-status', () => 'idle')

  const locale = () => getActiveLocale()
  const siteLocale = () => (locale() === 'pt-BR' ? 'pt-br' : 'en-us')

  /** The JSON of one page of Riot's site: the tag page, or the note at `path`. */
  async function readPage(path?: string): Promise<string> {
    if (insideTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<string>('riot_patch_notes_page', { language: locale(), path: path ?? null })
    }
    // The site redirects a note's path to its trailing-slash form, which a relative redirect would carry out of the proxy.
    const page = path ? `${path.replace(/\/$/, '')}/` : `/${siteLocale()}/news/tags/patch-notes/`
    const html = await $fetch<string>(`/__riot${page}`, { responseType: 'text' })
    const match = NEXT_DATA.exec(html)
    if (!match) throw new Error('the page carries no data')
    return match[1]!
  }

  async function loadList(force = false) {
    if (listStatus.value === 'loading') return
    if (!force && list.value.length > 0 && Date.now() - updatedAt.value < REFRESH_MS) return
    listStatus.value = 'loading'
    try {
      const fresh = parsePatchList(await readPage())
      if (fresh.length === 0) throw new Error('no patch in the list')
      list.value = fresh
      updatedAt.value = Date.now()
      listStatus.value = 'ready'
    }
    catch {
      // A failed refresh keeps the list already read; only a first read is an error.
      listStatus.value = list.value.length > 0 ? 'ready' : 'error'
    }
  }

  const noteKey = (summary: PatchSummary) => `${siteLocale()}:${summary.version}`
  const noteOf = (summary: PatchSummary | null) => (summary ? notes.value[noteKey(summary)] ?? null : null)

  async function loadNote(summary: PatchSummary) {
    if (notes.value[noteKey(summary)]) return
    noteStatus.value = 'loading'
    try {
      const note = parsePatchNote(await readPage(summary.path))
      notes.value = { ...notes.value, [noteKey(summary)]: note }
      noteStatus.value = 'ready'
    }
    catch {
      noteStatus.value = 'error'
    }
  }

  /** Reads the list now and keeps it fresh for as long as the caller lives. */
  function keepFresh() {
    void loadList()
    const timer = setInterval(() => void loadList(true), REFRESH_MS)
    const onFocus = () => void loadList()
    window.addEventListener('focus', onFocus)
    onBeforeUnmount(() => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    })
  }

  async function openOnSite(summary: PatchSummary) {
    if (insideTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_patch_note', { path: summary.path }).catch(() => {})
    }
    else {
      window.open(`https://www.leagueoflegends.com${summary.path}`, '_blank', 'noopener')
    }
  }

  return { list, listStatus, updatedAt, noteStatus, noteOf, loadList, loadNote, keepFresh, openOnSite }
}

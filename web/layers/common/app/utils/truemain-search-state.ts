import type { SearchResult } from '#shared/types/search'
import { tr } from '#common/utils/i18n'
import { SEARCH_MIN_LENGTH } from '#common/composables/useTruemainSearch'

// The truemain group of the search palette (`AppSearch`), classified once and
// read twice: by the palette's rows and by its aria-live announcement, so a new
// state is added in one place and the screen-reader text can't diverge from
// what is shown.

export type TruemainSearchState =
  | { kind: 'idle' }
  | { kind: 'tooShort' }
  | { kind: 'searching' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'refetching', results: SearchResult[] }
  | { kind: 'results', results: SearchResult[] }

export interface TruemainSearchInput {
  term: string
  tooShort: boolean
  status: 'idle' | 'pending' | 'success' | 'error'
  results: SearchResult[]
}

export function truemainSearchState({ term, tooShort, status, results }: TruemainSearchInput): TruemainSearchState {
  if (term.trim().length === 0) return { kind: 'idle' }
  if (tooShort) return { kind: 'tooShort' }
  if (status === 'error') return { kind: 'error' }
  if (status === 'pending') {
    return results.length > 0 ? { kind: 'refetching', results } : { kind: 'searching' }
  }
  if (results.length === 0) return { kind: 'empty' }
  return { kind: 'results', results }
}

export const TRUEMAIN_SEARCH_MESSAGES = {
  get tooShort() { return tr('search.state.tooShort', { min: SEARCH_MIN_LENGTH }) },
  get searching() { return tr('search.state.searching') },
  get empty() { return tr('search.state.empty') },
  /** When the results are narrowed to one champion's mains. */
  get emptyOnChampion() { return tr('search.state.emptyOnChampion') },
}

/**
 * What a screen reader hears for a state. `failed` is the fetch error in the
 * app's usual wording (`describeFetchError`); `empty` is the no-match line the
 * palette shows.
 */
export function truemainSearchAnnouncement(state: TruemainSearchState, failed: string, empty: string): string {
  switch (state.kind) {
    case 'idle': return ''
    case 'tooShort': return TRUEMAIN_SEARCH_MESSAGES.tooShort
    case 'searching':
    case 'refetching': return TRUEMAIN_SEARCH_MESSAGES.searching
    case 'error': return failed
    case 'empty': return empty
    case 'results': return tr(state.results.length > 1 ? 'search.state.foundMany' : 'search.state.foundOne', { count: state.results.length })
  }
}

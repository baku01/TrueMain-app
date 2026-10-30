import type { ProBuildData } from '~/utils/pro-build'
import { SAMPLE_PROS } from '~/utils/pro-build'

/**
 * The professionals and their builds. There is no source yet (see
 * `utils/pro-build.ts`): this answers the sample, flagged `source: 'sample'`
 * so the page says so. Connecting a real source means returning
 * `{ source: 'live', players }` from here — the page reads nothing else.
 */
export function useProBuilds() {
  const data = useState<ProBuildData>('pro-builds', () => ({ source: 'sample', players: SAMPLE_PROS }))
  return { data }
}

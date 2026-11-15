import { readonly, shallowRef } from 'vue'

/**
 * Where the app reads its numbers: every source at once, nothing to choose.
 * lolalytics, Mobalytics, Blitz, op.gg and Tencent (China) answer the
 * statistics, builds and recommendations, merged without counting a game
 * twice (`utils/sources`, `utils/sources/combined`). TrueMain's own API is
 * not asked — not even to stand in when they all fail: the shell refuses it
 * (`api.rs`), and what only it had is shown as unavailable.
 *
 * Listed most complete first: lolalytics and Mobalytics count nearly every
 * ranked game (Ahri's mid lane on 16.22, Emerald+: 262,160 and 263,049
 * games), op.gg and Blitz about nine tenths of them, Tencent China's servers
 * apart. A read only some sources measure asks them in this order, the first
 * that answers kept.
 */
export const DATA_SOURCES = ['lolalytics', 'mobalytics', 'blitz', 'opgg', 'tencent'] as const

/** A source a reader may list — TrueMain among them, though it is never asked (`standInOrder`). */
export type DataSource = typeof DATA_SOURCES[number] | 'truemain'

/** The sources whose reads are not TrueMain's. */
export type ExternalSource = Exclude<DataSource, 'truemain'>

/**
 * The source a read asks first when it measures the figure: the most
 * complete. What it does not measure, the readers' own orders (`standInOrder`,
 * `rankHistoryOrder`, …) ask of the others, in turn.
 */
export const LEAD_SOURCE: DataSource = 'lolalytics'

/** The lead source as the readers that once followed Settings' pick read it. */
export const leadSource = readonly(shallowRef<DataSource>(LEAD_SOURCE))

/**
 * The elo bracket the sources read when none is picked: the one their own
 * sites open on (lolalytics, Mobalytics, Blitz and op.gg all open on
 * Emerald+), not TrueMain's Master+ — on lolalytics, Aatrox's top lane on one
 * patch is 3,370 games in Master+ and 18,877 in Emerald+.
 */
export const SOURCE_ELO_BRACKET = 'EMERALD_PLUS'

/**
 * Tell the shell TrueMain's API is never to be asked (`api.rs`): it refuses
 * every request to it, its own included — the choice an older version kept
 * when TrueMain was the picked source is overwritten.
 */
export async function syncDataSourceWithShell() {
  if (!insideTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_data_source', { external: true }).catch(() => {})
}

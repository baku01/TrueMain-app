import type { InjectionKey } from 'vue'
import type { BuildOption, ChampionBuild, ChampionBuildResponse } from '~/types/build'
import type { DraftBuild } from '~/composables/useDraftBuild'
import type { BuildOptions } from '~/utils/sources/model'
import { playstyleOptions, readBlitzBuild, readBlitzOtpBuilds } from '~/utils/blitz/playstyles'
import { readPreviousBuild, storePreviousBuild } from '~/utils/previous-build'
import { rewardApart } from '~/utils/support-quest'

/**
 * Remembers the build on screen as the previous one: provided by a build view,
 * called by its import buttons (`BuildRuneImport`, `BuildItemSetImport`) —
 * an import is the player settling on that build. Absent elsewhere.
 */
export const REMEMBER_BUILD: InjectionKey<() => void> = Symbol('remember-build')

/**
 * A lane build as a list row: the whole path in its key, two builds may open
 * on the same item with the same keystone (another source's cores do) — and
 * its name, two of Blitz's playstyles often sharing their most played path.
 */
function rowOf(group: string, build: ChampionBuild): BuildOption {
  const path = `${build.firstItemId}-${build.primaryKeystoneId}-${(build.core.itemPath?.itemIds ?? []).join('_')}-${(build.core.boots?.itemIds ?? []).join('_')}`
  return {
    key: `${group}-${path}${build.name ? `-${build.name}` : ''}`,
    core: build.core,
    firstItemId: build.firstItemId,
    keystoneId: build.primaryKeystoneId,
    buildTree: build.buildTree,
    games: build.games,
    winRate: build.winRate,
    name: build.name ?? null,
    ...(build.places ? { places: build.places } : {}),
  }
}

/**
 * Below this many games a lane's builds stand for too few players to be its
 * build: Buildzcrank lists no option under 342 games and falls back to the
 * champion's most common build ("Not enough games analyzed for {champion} in
 * {role}"); LoLTheory models any rate under 30. Then the champion's main
 * lane's builds are offered too, and opened first.
 */
export const THIN_LANE_GAMES = 300

/**
 * Builds of the lane read from Blitz alone — what only it measures: the
 * one-tricks' (`readBlitzOtpBuilds`), the playstyles' (`readBlitzBuild`), the
 * builds against one opponent (with `opponent`). Null until read or when none
 * can be.
 */
function useBlitzBuilds(
  championId: Ref<number>,
  position: Ref<string>,
  readBuilds: (championId: number, position: string, opponent: number | null) => Promise<ChampionBuildResponse | null>,
  opponent: Ref<number | null> = ref(null),
) {
  const answer = shallowRef<ChampionBuildResponse | null>(null)
  let latest = 0
  watch(() => `${championId.value}:${position.value}:${opponent.value ?? ''}`, async () => {
    const read = ++latest
    answer.value = null
    const champion = championId.value
    const lane = position.value
    if (!lane) return
    const builds = await readBuilds(champion, lane, opponent.value).catch(() => null)
    if (read === latest) answer.value = builds
  }, { immediate: true })
  return answer
}

/** Blitz's playstyles of the lane (Bruiser, Tank…): only Blitz names its builds so. */
async function readPlaystyles(championId: number, position: string): Promise<ChampionBuildResponse | null> {
  return await readBlitzBuild(championId, position)
}

/** Blitz's builds in the games against one opponent — the only source that measures builds by matchup; none without an opponent. */
async function readVersus(championId: number, position: string, opponent: number | null): Promise<ChampionBuildResponse | null> {
  return opponent ? await readBlitzBuild(championId, position, opponent) : null
}

/**
 * The rows a build view switches between, in the list's order: the player's
 * previous build on the champion and lane (read once as the view opens on
 * them, so it is the earlier visit's, not the click just made), the draft's
 * own build, the builds played against the lane opponent (Blitz), the lane's
 * builds, the main lane's when the lane has too few games (`THIN_LANE_GAMES`),
 * Blitz's playstyles of the lane (Bruiser, Tank…) whatever the source, and the
 * one-tricks' builds. The default is the draft's own, else the main lane's
 * most played on a thin lane, else the lane's most played.
 */
export function useBuildOptions(
  championId: Ref<number>,
  position: Ref<string>,
  draft: Ref<{ build: DraftBuild | null, opponentId?: number | null } | null | undefined>,
) {
  const { response, pending } = useChampionBuilds(championId, position)
  /** Blitz measures builds by lane matchup: against the draft's lane opponent, its builds in those games (Blitz's "matchup builds"). */
  const versusOpponent = computed(() => draft.value?.opponentId ?? null)
  const versusResponse = useBlitzBuilds(championId, position, readVersus, versusOpponent)
  const otp = useBlitzBuilds(championId, position, readBlitzOtpBuilds)
  const styles = useBlitzBuilds(championId, position, readPlaystyles)

  // A lane the champion is rarely played on: its main lane's builds beside the lane's own.
  const { mainEntryOf } = useTierList()
  const laneGames = computed(() => {
    const answer = response.value
    if (!answer || answer.championId !== championId.value) return null
    return answer.totalGames || answer.builds.reduce((sum, build) => sum + build.games, 0)
  })
  const mainPosition = computed(() => {
    const main = mainEntryOf(championId.value)?.position ?? null
    return main && main !== position.value && laneGames.value !== null && laneGames.value < THIN_LANE_GAMES ? main : null
  })
  const { response: mainResponse } = useChampionBuilds(championId, mainPosition)
  /** The lane's games and the main lane offered beside it, when the lane's are too few; null otherwise. */
  const thinLane = computed(() => (mainPosition.value && laneGames.value !== null ? { games: laneGames.value, main: mainPosition.value } : null))

  const previous = shallowRef<BuildOption | null>(null)
  watch(() => `${championId.value}:${position.value}`, () => {
    previous.value = position.value ? readPreviousBuild(globalThis.localStorage, championId.value, position.value) : null
  }, { immediate: true })

  /** Keep `option` as the previous build here — a row picked by hand, a pro's game, an import. */
  function remember(option: BuildOption | null | undefined) {
    if (option && position.value) storePreviousBuild(globalThis.localStorage, championId.value, position.value, option)
  }

  const options = computed<BuildOption[]>(() => {
    const list: BuildOption[] = previous.value ? [previous.value] : []
    const draftBuild = draft.value?.build
    if (draftBuild && draftBuild.championId === championId.value) {
      list.push({
        key: 'draft',
        core: draftBuild.core,
        firstItemId: draftBuild.firstItemId,
        keystoneId: draftBuild.core.runePage?.primaryKeystoneId ?? null,
        buildTree: draftBuild.buildTree,
        games: draftBuild.games,
        winRate: draftBuild.games > 0 ? draftBuild.wins / draftBuild.games : null,
        standard: draftBuild.source === 'standard',
      })
    }
    const versus = versusResponse.value?.championId === championId.value && versusOpponent.value ? versusResponse.value.builds : []
    list.push(...versus.filter(build => build.games > 0).map(build => rowOf('versus', build)))
    list.push(...(response.value?.builds ?? []).map(build => rowOf('lane', build)))
    if (mainPosition.value && mainResponse.value?.championId === championId.value) list.push(...mainResponse.value.builds.map(build => rowOf('main', build)))
    // A lane Blitz answers with one document has no playstyle: its builds are the lane's own, unnamed.
    if (styles.value?.championId === championId.value) list.push(...styles.value.builds.filter(build => build.name).map(build => rowOf('style', build)))
    if (otp.value?.championId === championId.value) list.push(...otp.value.builds.map(build => rowOf('otp', build)))
    // A support's quest reward on its own, wherever a source wrote it (`rewardApart`).
    return list.map(option => ({ ...option, core: rewardApart(option.core) }))
  })

  /**
   * The row a view opens on: never the previous build, which is offered, not
   * chosen; the draft's own first; on a lane with too few games, the main
   * lane's most played rather than the lane's.
   */
  const defaultKey = computed(() => {
    const opened = (option: BuildOption) => option.key !== 'previous' && !option.key.startsWith('otp-') && !option.key.startsWith('style-')
    const draftRow = options.value.find(option => option.key === 'draft')
    const mainRow = thinLane.value ? options.value.find(option => option.key.startsWith('main-')) : undefined
    return draftRow?.key ?? mainRow?.key ?? options.value.find(opened)?.key ?? options.value[0]?.key ?? null
  })

  return { options, pending, versusOpponent, defaultKey, remember, thinLane }
}

/**
 * The build panel's options for a row named after a Blitz playstyle (a
 * playstyle's row, a one-trick row): that playstyle's own
 * document, not the lane's biggest. `undefined` for any other row — the panel
 * reads the source as always — and while the playstyle's are read; null when
 * they cannot be.
 */
export function usePlaystylePreset(championId: Ref<number>, position: Ref<string>, shown: Ref<BuildOption | null>) {
  const preset = shallowRef<BuildOptions | null | undefined>(undefined)
  const ready = ref(true)
  const named = computed(() => {
    const option = shown.value
    if (!option?.name) return null
    if (option.key.startsWith('otp-')) return { name: option.name, otp: true }
    return option.key.startsWith('style-') ? { name: option.name, otp: false } : null
  })
  let latest = 0
  watch(() => [championId.value, position.value, named.value?.name, named.value?.otp] as const, async ([champion, lane, name, otp]) => {
    const read = ++latest
    preset.value = undefined
    if (!name) {
      ready.value = true
      return
    }
    ready.value = false
    const options = await playstyleOptions(champion, lane, name, otp).catch(() => null)
    if (read !== latest) return
    preset.value = options ?? undefined
    ready.value = true
  }, { immediate: true })
  return { preset, ready }
}

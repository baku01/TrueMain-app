import type { CompositionBuildRequest } from '~/types/build'
import type { JevBase, LoadedBase } from '~/utils/jev-bases'
import { LANE_BASE, baseCandidates, baseTag, laneOptions, resolveBases } from '~/utils/jev-bases'

/**
 * The bases Jev can rank within for the build on screen (`utils/jev-bases`),
 * and the one the player chose — the lane by default. The families are read
 * (sources only, never Jev) while `active`, once per champion, lane and lane
 * opponent; only the ones that answered a core are offered, and a choice that
 * disappears with a new draft goes back to the lane.
 */
export function useJevBases(subject: Ref<{ championId: number, request: CompositionBuildRequest } | null>, active: Ref<boolean>) {
  const bases = shallowRef<LoadedBase[]>([])
  const selected = ref<string>(LANE_BASE.key)
  const pending = ref(false)

  const opponentOf = (request: CompositionBuildRequest) => request.enemies.find(enemy => enemy.position === request.position)?.championId ?? null
  const target = computed(() => {
    const current = subject.value
    return current ? { championId: current.championId, position: current.request.position, opponentId: opponentOf(current.request) } : null
  })
  const targetKey = computed(() => (target.value ? `${target.value.championId}:${target.value.position}:${target.value.opponentId ?? ''}` : null))

  let loadedKey: string | null = null
  let loading: Promise<LoadedBase[]> | null = null

  function load(): Promise<LoadedBase[]> {
    const now = target.value
    const key = targetKey.value
    if (!now || !key) return Promise.resolve([])
    if (key === loadedKey && loading) return loading
    loadedKey = key
    pending.value = true
    bases.value = []
    const read = baseCandidates(now.championId, now.position, now.opponentId).then(resolveBases).catch(() => [] as LoadedBase[])
    loading = read
    void read.then((list) => {
      if (loading !== read) return
      bases.value = list
      if (!list.some(entry => entry.base.key === selected.value)) selected.value = LANE_BASE.key
    }).finally(() => {
      if (loading === read) pending.value = false
    })
    return read
  }

  watch([targetKey, active], ([key, on]) => {
    if (key && on && key !== loadedKey) void load()
  }, { immediate: true })

  /** The base chosen, read if it was not yet: what Jev's click ranks within. The lane when the choice is gone. */
  async function chosen(): Promise<LoadedBase | null> {
    const list = await load()
    const found = list.find(entry => entry.base.key === selected.value) ?? list.find(entry => entry.base.key === LANE_BASE.key)
    if (found) return found
    const now = target.value
    const options = now ? await laneOptions(now.championId, now.position).catch(() => null) : null
    return options ? { base: LANE_BASE, options } : null
  }

  const offered = computed<JevBase[]>(() => bases.value.map(entry => entry.base))
  return { offered, selected, pending, chosen, opponentId: computed(() => target.value?.opponentId ?? null) }
}

/**
 * A base in words: in full for the selector ("Lane (all)", "Matchup vs Akali",
 * "Lethality", "One-tricks"), short after "Jev ·" in a build's title, and as
 * its tag in import titles (`baseTag`).
 */
export function useJevBaseLabels() {
  const { t } = useT()
  const { nameOf } = useChampionStatics()
  const opponentOf = (base: JevBase) => Number(base.key.split(':')[1]) || null
  function label(base: JevBase): string {
    if (base.kind === 'lane') return t('jevbase.lane')
    if (base.kind === 'matchup') return t('jevbase.matchup', { name: nameOf(opponentOf(base) ?? 0) })
    return base.kind === 'otp' ? t('jevbase.otp') : base.name ?? ''
  }
  function short(base: JevBase | null): string {
    if (!base || base.kind === 'lane') return t('jevbase.laneShort')
    return base.kind === 'matchup' ? t('jevbase.versus', { name: nameOf(opponentOf(base) ?? 0) }) : label(base)
  }
  const tag = (base: JevBase | null) => baseTag(base, { matchup: t('jevbase.tag.matchup'), otp: t('jevbase.tag.otp') })
  return { label, short, tag }
}

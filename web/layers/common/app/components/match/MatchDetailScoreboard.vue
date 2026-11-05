<script setup lang="ts">
import type { MatchDetailParticipant, MatchDetailTeam } from '#shared/types/match-detail'
import type {
  ChampionStaticListItem,
  RuneTreeResponse,
  StaticItemData,
  StaticSummonerSpellData,
} from '#shared/types/static-data'

const { t } = useT()

// One side of the Overview tab, as Blitz's scoreboard draws it: a header with
// the side's name in its colour, its K / D / A, the objectives it took (when
// the source counted them: the app's, never the API's, #523), its gold and its
// damage to champions; then one `MatchDetailScoreboardRow` per player, each
// damage bar measured against the side's top dealer.
const props = defineProps<{
  participants: MatchDetailParticipant[]
  teamId: number
  win: boolean
  /** The side's bans and objectives, when the source has them. */
  team?: MatchDetailTeam | null
  /** The row's owner, highlighted. */
  selfParticipantId?: number | null
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse
}>()

const championById = computed(() => new Map(props.champions.map(c => [c.championId, c])))
const blue = computed(() => props.teamId === 100)

const maxDamage = computed(() =>
  props.participants.reduce((max, p) => Math.max(max, p.totalDamageDealtToChampions), 0),
)
const total = computed(() => props.participants.reduce(
  (acc, p) => ({
    k: acc.k + p.kills,
    d: acc.d + p.deaths,
    a: acc.a + p.assists,
    gold: acc.gold + p.goldEarned,
    damage: acc.damage + p.totalDamageDealtToChampions,
  }),
  { k: 0, d: 0, a: 0, gold: 0, damage: 0 },
))

const objectives = computed(() => {
  const team = props.team
  if (!team) return []
  return [
    [
      { icon: 'i-tabler-tower', count: team.towers, label: t('match.scoreboard.towers') },
      { icon: 'i-tabler-hexagon', count: team.inhibitors, label: t('match.scoreboard.inhibitors') },
    ],
    [
      { icon: 'i-tabler-skull', count: team.barons, label: t('match.scoreboard.barons') },
      { icon: 'i-tabler-dragon', count: team.dragons, label: t('match.scoreboard.dragons') },
      { icon: 'i-tabler-eye', count: team.heralds, label: t('match.scoreboard.heralds') },
      ...(team.grubs !== null ? [{ icon: 'i-tabler-bug', count: team.grubs, label: t('match.scoreboard.grubs') }] : []),
    ],
  ]
})
</script>

<template>
  <section class="@container surface overflow-hidden rounded-xl">
    <header class="flex h-9 items-center justify-between gap-4 border-b border-default bg-elevated/50 px-4 text-xs font-semibold text-muted tabular-nums">
      <span class="w-28 shrink-0 text-[13px]" :class="blue ? 'text-sky-400' : 'text-red-400'">
        {{ blue ? t('match.scoreboard.blueTeam') : t('match.scoreboard.redTeam') }}
      </span>
      <span class="hidden font-medium @[36rem]:inline">{{ total.k }} / {{ total.d }} / {{ total.a }}</span>
      <span v-for="(group, index) in objectives" :key="index" class="flex items-center gap-3">
        <UTooltip v-for="objective in group" :key="objective.icon" :text="objective.label">
          <span class="flex items-center gap-0.5">
            <UIcon :name="objective.icon" class="size-4" :aria-label="objective.label" />
            {{ objective.count }}
          </span>
        </UTooltip>
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-tabler-coins" class="size-4" />
        {{ total.gold.toLocaleString() }}
      </span>
      <span class="hidden @[36rem]:inline">{{ t('match.scoreboard.damageTotal', { value: total.damage.toLocaleString() }) }}</span>
    </header>

    <ul>
      <MatchDetailScoreboardRow
        v-for="p in participants"
        :key="p.participantId"
        :participant="p"
        :champion="championById.get(p.championId) ?? null"
        :max-damage="maxDamage"
        :blue="blue"
        :self="p.participantId === selfParticipantId"
        :items="items"
        :summoner-spells="summonerSpells"
        :rune-tree="runeTree"
      />
    </ul>
  </section>
</template>

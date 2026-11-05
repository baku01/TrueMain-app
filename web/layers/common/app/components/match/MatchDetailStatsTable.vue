<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import { championDisplayName } from '#shared/utils/champion-name'

const { t } = useT()

// The Stats tab, Blitz's table of the game: the ten players as columns (blue
// side, then red, each portrait framed in its side's colour) and one row per
// measure, the game's highest of each brought forward.
const props = defineProps<{
  blueTeam: MatchDetailParticipant[]
  redTeam: MatchDetailParticipant[]
  champions: ChampionStaticListItem[]
  selfParticipantId?: number | null
}>()

const championById = computed(() => new Map(props.champions.map(c => [c.championId, c])))
const canonicalIcon = useCanonicalIcon()
const players = computed(() => [...props.blueTeam, ...props.redTeam])

interface Row { label: string, value: (p: MatchDetailParticipant) => number, format?: (value: number) => string }

const percent = (value: number) => `${Math.round(value * 100)}%`
const decimal = (value: number) => value.toFixed(1)

const rows = computed<Row[]>(() => [
  { label: t('match.stats.kills'), value: p => p.kills },
  { label: t('match.stats.deaths'), value: p => p.deaths },
  { label: t('match.stats.assists'), value: p => p.assists },
  { label: t('match.stats.killParticipation'), value: p => p.killParticipation, format: percent },
  { label: t('match.stats.damage'), value: p => p.totalDamageDealtToChampions },
  { label: t('match.stats.damagePerMin'), value: p => p.damagePerMin, format: value => Math.round(value).toLocaleString() },
  { label: t('match.stats.gold'), value: p => p.goldEarned },
  { label: t('match.stats.goldPerMin'), value: p => p.goldPerMin, format: value => Math.round(value).toLocaleString() },
  { label: t('match.stats.cs'), value: p => p.cs },
  { label: t('match.stats.csPerMin'), value: p => p.csPerMin, format: decimal },
  { label: t('match.stats.vision'), value: p => p.visionScore },
  { label: t('match.stats.visionPerMin'), value: p => p.visionPerMin, format: value => value.toFixed(2) },
  { label: t('match.stats.level'), value: p => p.champLevel },
])

const cells = computed(() => rows.value.map((row) => {
  const values = players.value.map(row.value)
  const top = Math.max(...values)
  return {
    label: row.label,
    values: values.map(value => ({ text: row.format ? row.format(value) : value.toLocaleString(), top: value === top && top > 0 })),
  }
}))
</script>

<template>
  <div class="surface overflow-x-auto rounded-xl">
    <table class="w-full min-w-[44rem] text-xs tabular-nums">
      <thead>
        <tr class="border-b border-default bg-elevated/50">
          <th class="w-36" />
          <th v-for="(p, index) in players" :key="p.participantId" class="px-1 py-2" :class="index === blueTeam.length && 'border-l border-default'">
            <img
              :src="canonicalIcon(championById.get(p.championId)?.iconUrl) ?? undefined"
              :alt="championDisplayName(p.championId, championById.get(p.championId))"
              :title="p.gameName ?? p.summonerName"
              width="28"
              height="28"
              class="img-skeleton mx-auto size-7 rounded-full ring-2"
              :class="[p.teamId === 100 ? 'ring-sky-400' : 'ring-red-400', p.participantId === selfParticipantId && 'outline-2 outline-offset-2 outline-gold']"
            >
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in cells" :key="row.label" class="border-b border-default/60 last:border-b-0 hover:bg-elevated/40">
          <th class="px-4 py-1.5 text-left font-medium text-muted">{{ row.label }}</th>
          <td
            v-for="(cell, index) in row.values"
            :key="index"
            class="px-1 py-1.5 text-center"
            :class="[cell.top ? 'font-semibold text-gold' : 'text-default', index === blueTeam.length && 'border-l border-default']"
          >
            {{ cell.text }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

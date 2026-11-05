<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { WinProbabilityTimeline } from '#shared/types/win-probability'
import { axisEvents, axisRows } from '#common/utils/timeline-events'
import { formatGameClock } from '#common/utils/win-probability-swing'
import { championDisplayName } from '#shared/utils/champion-name'

const { t } = useT()

// The Timeline tab, as Blitz lists a game: every kill and objective in time
// order down a centre line, the blue side's on its left and the red side's on
// its right — a kill as its killer's champion over the victims' (a multi-kill
// one line, named), an objective as the game's minimap icon of it. The same
// reading of the timeline as the event axis under the curves (`axisEvents`,
// `axisRows`), its labels worded for the row's owner ("Your Infernal Drake").
const props = defineProps<{
  timeline: WinProbabilityTimeline
  perspectiveTeamId: number
  participants: MatchDetailParticipant[]
  champions: ChampionStaticListItem[]
}>()

const championsById = useChampionsById(() => props.champions)
const canonicalIcon = useCanonicalIcon()
const championOf = computed(() => new Map(props.participants.map(p => [p.participantId, p.championId])))

function champion(participantId: number | null) {
  const id = participantId === null ? 0 : championOf.value.get(participantId) ?? 0
  const known = championsById.value.get(id)
  return { name: participantId === null ? t('match.kills.executed') : championDisplayName(id, known), icon: canonicalIcon(known?.iconUrl) ?? null }
}

const rows = computed(() => {
  const events = axisEvents(props.timeline, props.perspectiveTeamId)
  const blueIsOurs = props.perspectiveTeamId === 100
  return axisRows({ ms: 0, ours: true, events }).map(row => ({ ...row, clock: formatGameClock(row.ms), blue: row.ours === blueIsOurs }))
})
</script>

<template>
  <div class="surface rounded-xl p-4">
    <p v-if="!rows.length" class="py-6 text-center text-sm text-muted">{{ t('match.timeline.empty') }}</p>
    <ol v-else class="relative flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-default">
      <li v-for="(row, index) in rows" :key="index" class="grid grid-cols-[1fr_3.5rem_1fr] items-center">
        <div class="flex justify-end pr-3" :class="!row.blue && 'invisible'">
          <MatchDetailEventTimelineLine v-if="row.blue" :row="row" :champion="champion" side="blue" />
        </div>
        <span class="relative z-[1] mx-auto rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted ring-1 ring-default">{{ row.clock }}</span>
        <div class="flex justify-start pl-3" :class="row.blue && 'invisible'">
          <MatchDetailEventTimelineLine v-if="!row.blue" :row="row" :champion="champion" side="red" />
        </div>
      </li>
    </ol>
  </div>
</template>

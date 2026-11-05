<script setup lang="ts">
import { championDisplayName } from '#shared/utils/champion-name'
import type { MatchSummaryParticipant } from '#shared/types/matches'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import { riotIdLabel } from '#shared/utils/truemain-path'
import { compareByPosition, POSITION_BY_VALUE } from '#common/utils/positions'
import { iconPlaceholderClass } from '#common/utils/icon-placeholder'

// Both compositions of a match row, the player's team over the enemy's, each in
// lane order so a column pairs laner against laner.
//
// Ten plain <img>s on the canonical icon URL rather than ten `SkeletonImage`s
// (#2129): a 16 px glyph with no tooltip is not worth a component instance each,
// twenty times a page. The loading skeleton is the picture's own background
// (`img-skeleton`), which the opaque portrait covers once decoded; `load` takes
// the class off so 200 covered pulses do not keep repainting (where `load` is
// missed — a cached image before hydration, the app's WKWebView — the pulse
// stops on its own after a few cycles). A champion the static list does not
// know draws the hollow "no icon" box: the list has landed before any row is
// drawn, so its absence is final.
//
// In a wide tile (the row's container past 50rem) the two teams stand side by
// side as Blitz lists them, each player's Riot ID beside the portrait and the
// player's own line brought forward.
const props = defineProps<{
  participants: MatchSummaryParticipant[]
  selfTeamId: number
  championById: Map<number, ChampionStaticListItem>
  /** The player's champion: their line in the named teams is highlighted. */
  selfChampionId?: number | null
}>()

const canonicalIcon = useCanonicalIcon()
const unresolvedClass = iconPlaceholderClass(true)

const teams = computed(() => [
  props.participants.filter(p => p.teamId === props.selfTeamId).sort(compareByPosition),
  props.participants.filter(p => p.teamId !== props.selfTeamId).sort(compareByPosition),
].map((team, side) => team.map(p => ({
  src: canonicalIcon(props.championById.get(p.championId)?.iconUrl),
  label: participantLabel(p),
  name: p.gameName ?? championDisplayName(p.championId, props.championById.get(p.championId)),
  self: side === 0 && p.championId === props.selfChampionId,
}))))

function settle(event: Event) {
  (event.target as HTMLElement).classList.remove('img-skeleton')
}

function participantLabel(p: MatchSummaryParticipant): string {
  const champion = championDisplayName(p.championId, props.championById.get(p.championId))
  const role = p.position ? POSITION_BY_VALUE.get(p.position)?.label : null
  const who = p.gameName ? ` — ${riotIdLabel(p.gameName, p.tagLine)}` : ''
  return role ? `${champion} · ${role}${who}` : `${champion}${who}`
}
</script>

<template>
  <div class="hidden grid-cols-2 gap-x-3 @[50rem]:grid">
    <ul v-for="(team, side) in teams" :key="side" class="flex w-[6.75rem] flex-col gap-0.5">
      <li v-for="(p, index) in team" :key="index" class="flex min-w-0 items-center gap-1.5" :title="p.label">
        <img
          v-if="p.src"
          :src="p.src"
          alt=""
          width="16"
          height="16"
          loading="lazy"
          class="img-skeleton size-4 shrink-0 rounded-sm"
          @load="settle"
        >
        <span v-else class="size-4 shrink-0 rounded-sm" :class="unresolvedClass" />
        <span class="truncate text-[11px] leading-4" :class="p.self ? 'font-semibold text-highlighted' : 'text-muted'">{{ p.name }}</span>
      </li>
    </ul>
  </div>
  <div class="flex flex-col gap-0.5 @[50rem]:hidden">
    <div v-for="(team, side) in teams" :key="side" class="flex gap-0.5">
      <template v-for="(p, index) in team" :key="index">
        <img
          v-if="p.src"
          :src="p.src"
          :alt="p.label"
          :title="p.label"
          width="16"
          height="16"
          loading="lazy"
          class="img-skeleton size-4 rounded-sm"
          @load="settle"
        >
        <span
          v-else
          :title="p.label"
          class="size-4 rounded-sm"
          :class="unresolvedClass"
        ><span class="sr-only">{{ p.label }}</span></span>
      </template>
    </div>
  </div>
</template>

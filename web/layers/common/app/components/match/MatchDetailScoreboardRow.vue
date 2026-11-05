<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import type {
  ChampionStaticListItem,
  RuneTreeResponse,
  StaticItemData,
  StaticSummonerSpellData,
} from '#shared/types/static-data'
import { championDisplayName } from '#shared/utils/champion-name'
import { formatKda, kdaRatio } from '#shared/utils/kda'
import { ordinal } from '#common/utils/ordinal'

const { t } = useT()

// One player of the scoreboard, on Blitz's line: the champion in a round frame
// of the side's colour with the level on its corner, the spells and runes, the
// name (the owner's in gold), the placement tag (MVP gold, SVP blue, 2nd
// silver, 3rd bronze, the rest grey; the score in its tooltip), the rank, the
// seven slots, the K / D / A over the ratio, the CS over the kill
// participation, and the damage over a bar measured against the side's top.
const props = defineProps<{
  participant: MatchDetailParticipant
  champion: ChampionStaticListItem | null
  /** Highest damage on the side — the bar's full width. */
  maxDamage: number
  blue: boolean
  self?: boolean
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse
}>()

const p = computed(() => props.participant)
const championName = computed(() => championDisplayName(p.value.championId, props.champion))
const canonicalIcon = useCanonicalIcon()
const icon = computed(() => canonicalIcon(props.champion?.iconUrl))

const tag = computed(() => {
  const { placement, isMvp, isAce } = p.value
  if (!placement) return null
  if (isMvp) return { text: 'MVP', tone: 'bg-gold/20 text-gold' }
  if (isAce) return { text: 'SVP', tone: 'bg-primary/20 text-primary' }
  const text = ordinal(placement)
  if (placement === 2) return { text, tone: 'bg-[#bfbfbf]/20 text-[#bfbfbf]' }
  if (placement === 3) return { text, tone: 'bg-[#c79460]/20 text-[#c79460]' }
  return { text, tone: 'bg-muted text-muted' }
})

const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
const DIVISION: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4' }
/** Iron to Diamond as the tier's initial and the division (`S2`); Master and above as their LP. */
const rankShort = computed(() => {
  const rank = p.value.rank
  if (!rank) return null
  if (APEX.includes(rank.tier)) return `${rank.leaguePoints} LP`
  return `${rank.tier[0]}${DIVISION[rank.division] ?? rank.division}`
})

// The ratio warms with the game: grey, the app's data tones, gold at the top.
const ratio = computed(() => (p.value.deaths === 0 ? Infinity : kdaRatio(p.value)))
const ratioTone = computed(() => {
  if (ratio.value >= 5) return 'text-gold'
  if (ratio.value >= 3) return 'text-data-good'
  return 'text-muted'
})

const percent = computed(() => (props.maxDamage > 0 ? (p.value.totalDamageDealtToChampions / props.maxDamage) * 100 : 0))
const slots = computed(() => [...p.value.items, p.value.trinketItemId])
</script>

<template>
  <li class="@container/row flex items-center gap-2 border-b border-default/60 px-3 py-1.5 transition-colors last:border-b-0 hover:bg-elevated/40">
    <div class="relative shrink-0" :title="championName">
      <img
        v-if="icon"
        :src="icon"
        :alt="championName"
        width="32"
        height="32"
        loading="lazy"
        class="img-skeleton size-8 rounded-full ring-2"
        :class="blue ? 'ring-sky-400' : 'ring-red-400'"
      >
      <span v-else class="block size-8 rounded-full bg-elevated ring-2" :class="blue ? 'ring-sky-400' : 'ring-red-400'" />
      <span class="absolute -bottom-1 -right-1 text-[10px] font-semibold tabular-nums text-highlighted [paint-order:stroke] [-webkit-text-stroke:3px_var(--ui-bg)]">{{ p.champLevel }}</span>
    </div>

    <MatchRowSpellsRunes :self="p" :summoner-spells="summonerSpells" :rune-tree="runeTree" />

    <div class="w-[8ch] min-w-0 flex-1 @[44rem]:w-[16ch] @[44rem]:flex-none">
      <MatchDetailScoreboardIdentity :participant="p" :self="self" />
    </div>

    <UTooltip v-if="tag" :text="t('match.scoreboard.score', { score: p.performanceScore })">
      <span class="w-[5ch] shrink-0 rounded-[5px] py-0.5 text-center text-[11px] font-bold tabular-nums" :class="tag.tone">{{ tag.text }}</span>
    </UTooltip>
    <span v-else class="w-[5ch] shrink-0" />

    <div class="hidden w-8 shrink-0 flex-col items-center gap-0.5 @[40rem]:flex" :title="p.rank ? `${p.rank.tier} ${p.rank.division}` : undefined">
      <RankIcon v-if="p.rank" :tier="p.rank.tier" :size="16" />
      <span v-else class="size-4 rounded-full bg-elevated opacity-50" />
      <span class="text-[10px] font-semibold uppercase leading-none text-muted">{{ rankShort ?? '-' }}</span>
    </div>

    <div class="hidden shrink-0 gap-0.5 @[44rem]:flex">
      <template v-for="(itemId, index) in slots" :key="index">
        <GameTooltipItemIcon
          v-if="itemId && items[itemId]"
          :item="items[itemId]!"
          :width="22"
          :height="22"
          class="rounded"
        />
        <span v-else class="size-[22px] rounded bg-elevated/60" />
      </template>
    </div>

    <div class="ml-auto w-[8ch] shrink-0 text-center leading-tight tabular-nums">
      <p class="text-xs font-medium text-highlighted">{{ p.kills }} / {{ p.deaths }} / {{ p.assists }}</p>
      <p class="text-[11px] font-semibold" :class="ratioTone">{{ formatKda(p) }}</p>
    </div>

    <div class="hidden w-[8ch] shrink-0 text-center leading-tight tabular-nums @[36rem]:block">
      <p class="text-xs font-medium text-highlighted">{{ p.cs }} CS</p>
      <p class="text-[11px] text-muted">{{ t('match.row.kp', { value: Math.round(p.killParticipation * 100) }) }}</p>
    </div>

    <div class="hidden w-[11ch] shrink-0 flex-col items-end gap-1 @[30rem]:flex">
      <span class="text-xs font-medium tabular-nums text-highlighted">{{ t('match.scoreboard.damageTotal', { value: p.totalDamageDealtToChampions.toLocaleString() }) }}</span>
      <span class="h-1 w-full overflow-hidden rounded-full bg-elevated">
        <span class="block h-full rounded-full" :class="blue ? 'bg-sky-400' : 'bg-red-400'" :style="{ width: `${percent}%` }" />
      </span>
    </div>
  </li>
</template>

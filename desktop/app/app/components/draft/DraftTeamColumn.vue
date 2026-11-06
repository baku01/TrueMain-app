<script setup lang="ts">
import type { Lane, TeamRow } from '~/types/draft'
import { teamDamage } from '~/utils/damage-profile'
import type { EnemyCounter } from '~/utils/draft-counters'

/**
 * One side of the board: its five picks over their lanes, under its name in
 * the side's colour (the damage mix is the screen's own section). The enemy side's lanes can be corrected by drag; once they
 * have been, a reset puts the guesser's answer back.
 */
const props = defineProps<{
  team: 'ally' | 'enemy'
  rows: TeamRow[]
  selectedCell: number
  opponentCell: number
  /** Portraits to suggest in our own empty slot. */
  suggested?: number[]
  /** Enemy lanes resolved: the cards can be dragged to correct them. */
  correctable?: boolean
  /** The player moved an enemy lane by hand: the reset is offered. */
  hasCorrections?: boolean
  /** By enemy champion: who beats it on its lane (the enemy side). */
  counters?: Map<number, EnemyCounter[]> | null
  /** One pick a line: the team as a column beside the screen's card. */
  vertical?: boolean
  /** The side's picks as its damage split reads them: a slim bar under the column's name. */
  damagePicks?: { championId: number, position: string | null }[]
}>()

const emit = defineEmits<{ view: [championId: number], swap: [from: Lane, to: Lane], reset: [] }>()
const { t } = useT()
const { profileOf } = useDamageProfiles()
const split = computed(() => {
  const picks = props.damagePicks
  return picks?.length ? teamDamage(picks.map(pick => profileOf(pick.championId, pick.position))) : null
})
const percent = (value: number) => `${Math.round(value * 100)}%`

/** The split sent to the lobby's chat on a click, as Blitz shares it: the line is the player's to send. */
const toast = useToast()
const sharing = ref(false)
async function share() {
  const damage = split.value
  if (!damage || sharing.value || !insideTauri()) return
  sharing.value = true
  const message = t('damage.share.line', {
    team: props.team === 'ally' ? t('damage.meter.ally') : t('damage.meter.enemy'),
    physical: percent(damage.physicalShare),
    magic: percent(damage.magicShare),
    true: percent(damage.trueShare),
  })
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('champ_select_chat', { message })
    toast.add({ title: t('damage.share.sent'), description: message, icon: 'i-lucide-check', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('damage.share.failed'), description: String(error), icon: 'i-lucide-circle-x', color: 'error' })
  }
  finally {
    sharing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- The damage split in the app's own tones: a soft sand for physical, the primary's lavender for magic, a pale grey for true. -->
    <header
      class="flex flex-col gap-1.5 px-0.5 pb-1 [--dmg-ad:oklch(0.8_0.07_70)] [--dmg-ap:color-mix(in_oklch,var(--ui-primary)_65%,oklch(0.8_0.09_290))] [--dmg-true:oklch(0.88_0_0/0.55)]"
      :class="team === 'enemy' && 'items-end text-right'"
    >
      <div class="flex w-full items-baseline gap-2" :class="team === 'enemy' && 'flex-row-reverse'">
        <span class="font-display text-[11px] font-bold uppercase tracking-[0.18em]" :class="team === 'ally' ? 'text-ally' : 'text-enemy'">{{ team === 'ally' ? t('draft.team.ours') : t('draft.team.theirs') }}</span>
        <span v-if="split" class="ml-auto text-[10px] font-semibold tabular-nums text-muted" :class="team === 'enemy' && 'ml-0 mr-auto'">
          <span class="text-(--dmg-ad)">{{ percent(split.physicalShare) }} AD</span> · <span class="text-(--dmg-ap)">{{ percent(split.magicShare) }} AP</span>
        </span>
        <UButton
          v-if="split && insideTauri()"
          icon="i-lucide-message-square-share"
          size="xs"
          color="neutral"
          variant="ghost"
          :loading="sharing"
          :title="t('damage.share.title')"
          :aria-label="t('damage.share.title')"
          class="-my-1"
          @click="share"
        />
      </div>
      <div v-if="split" class="flex h-1 w-full overflow-hidden rounded-full bg-accented/40" :class="team === 'enemy' && 'flex-row-reverse'" :title="team === 'ally' ? t('damage.meter.ally') : t('damage.meter.enemy')">
        <span class="bg-(--dmg-ad)" :style="{ width: percent(split.physicalShare) }" />
        <span class="bg-(--dmg-ap)" :style="{ width: percent(split.magicShare) }" />
        <span class="bg-(--dmg-true)" :style="{ width: percent(split.trueShare) }" />
      </div>
    </header>
    <div class="relative">
      <DraftTeam
        :team="team"
        :rows="rows"
        :selected-cell="selectedCell"
        :opponent-cell="opponentCell"
        :suggested="suggested"
        :correctable="correctable"
        :counters="counters"
        :vertical="vertical"
        @view="emit('view', $event)"
        @swap="(from, to) => emit('swap', from, to)"
      />
      <UButton
        v-if="hasCorrections"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :label="t('draft.team.resetLanes')"
        class="absolute -bottom-1.5 right-0"
        @click="emit('reset')"
      />
    </div>
  </div>
</template>

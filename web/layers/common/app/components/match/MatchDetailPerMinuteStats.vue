<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import type { MatchDetailStat } from './MatchDetailStatGrid.vue'

const { t } = useT()

// The selected player's whole-game rates. Ward counts and control wards are
// absent on purpose: the detail payload doesn't carry them yet.
const props = defineProps<{
  participant: MatchDetailParticipant
}>()

const stats = computed<MatchDetailStat[]>(() => {
  const p = props.participant
  return [
    { value: p.csPerMin.toFixed(1), label: t('match.perMinute.cs'), tone: 'text-default' },
    { value: p.visionPerMin.toFixed(1), label: t('match.perMinute.vision'), tone: 'text-default' },
    { value: p.damagePerMin.toFixed(0), label: t('match.perMinute.damage'), tone: 'text-default' },
    { value: p.goldPerMin.toFixed(0), label: t('match.perMinute.gold'), tone: 'text-default' },
  ]
})
</script>

<template>
  <MatchDetailCard :title="t('match.perMinute.title')" icon="i-lucide-activity">
    <MatchDetailStatGrid :stats="stats" />
  </MatchDetailCard>
</template>

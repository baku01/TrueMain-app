<script setup lang="ts">
/**
 * The champion's damage on the lane, as Blitz's build page closes on it
 * ("Damage Breakdown"): its measured physical, magic and true shares
 * (`useDamageProfiles`). Nothing when the champion is not measured.
 */
const props = defineProps<{ championId: number, position: string | null }>()
const { t } = useT()
const { profileOf } = useDamageProfiles()
const split = computed(() => {
  const profile = profileOf(props.championId, props.position)
  return profile?.physicalShare != null && profile.magicShare != null && profile.trueShare != null
    ? { physicalShare: profile.physicalShare, magicShare: profile.magicShare, trueShare: profile.trueShare }
    : null
})
</script>

<template>
  <section v-if="split" class="surface flex flex-col gap-2 rounded-xl px-4 py-3">
    <h3 class="stat-label">{{ t('damage.champion.title') }}</h3>
    <DamagePills :split="split" />
  </section>
</template>

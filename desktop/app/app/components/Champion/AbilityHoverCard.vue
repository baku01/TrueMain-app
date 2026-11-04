<script setup lang="ts">
import type { AbilityData } from '~/utils/ability-data'
import { getActiveLocale } from '#common/utils/i18n'
import AbilityClip from '~/components/Champion/AbilityClip.vue'
import { readAbilities } from '~/utils/ability-data'

/** The tooltip's card: the champion's abilities read when it opens (kept for the session), this one drawn compact. */
const props = defineProps<{ championId: number, spellKey: 'P' | 'Q' | 'W' | 'E' | 'R' }>()
const ability = shallowRef<AbilityData | null>(null)
const failed = ref(false)
const { championStatic } = useStaticData()
readAbilities(props.championId, getActiveLocale().startsWith('pt') ? 'pt' : 'en')
  .then(list => (ability.value = list.find(entry => entry.key === props.spellKey) ?? null))
  .catch(() => (failed.value = true))
</script>

<template>
  <div class="w-[26rem] max-w-[90vw]">
    <AbilityClip v-if="ability" :champion-id="championId" :ability="ability" :resource="ability.resource ?? championStatic(championId)?.partype ?? null" compact />
    <div v-else-if="!failed" class="space-y-2 p-3"><USkeleton class="aspect-video w-full" /><USkeleton class="h-4 w-2/3" /><USkeleton class="h-12 w-full" /></div>
  </div>
</template>

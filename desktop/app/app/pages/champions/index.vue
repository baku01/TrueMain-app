<!-- The site's champion directory, the same component (`web/layers/common`,
     #1732): only the frame is the app's (`SharedPage`), and the win-rate
     change since the patch before, which the site's API does not keep — read
     from the picked source, or the one standing in for it (`readWinRateChanges`). -->
<script setup lang="ts">
import type { WinRateChanges } from '~/utils/sources/patch-change'
import { changeKey, readWinRateChanges } from '~/utils/sources/patch-change'

const { t } = useT()
const { filters } = useChampionFilters()

const read = ref<WinRateChanges | null>(null)
watch(() => filters.value.eloBracket, async (eloBracket) => {
  read.value = null
  read.value = await readWinRateChanges(eloBracket || undefined).catch(() => null)
}, { immediate: true })

const winRateChange = (championId: number, position: string) => read.value?.changes.get(changeKey(championId, position)) ?? null
const note = computed(() => (read.value?.since ? t('stats.since', { patch: read.value.since }) : null))
</script>

<template>
  <SharedPage :eyebrow="t('app.page.buildsStats')" :title="t('app.page.champions')">
    <PageChampions :win-rate-change="winRateChange" :win-rate-change-note="note">
      <template v-if="read" #note>
        <span class="flex items-center gap-2 text-xs text-dimmed">
          {{ t('stats.changeFrom') }}<template v-if="read.since"> · {{ t('stats.since', { patch: read.since }) }}</template>
          <StatsSourceBadge :source="read.source" />
        </span>
      </template>
    </PageChampions>
  </SharedPage>
</template>

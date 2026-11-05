<!-- The matchup page with Jev's build and runes in place of the app's own
     (`JevBuildAdvice`): where the Jev integration is tried, on the same board
     as the matchup tool (`PageMatchup`). -->
<script setup lang="ts">
import { MATCH_DETAIL_SOURCE } from '#common/utils/match-detail-source'
import { blitzMatchDetail } from '~/utils/blitz/match-detail'
import JevBuildAdvice from '~/components/jev/JevBuildAdvice.vue'

const { t } = useT()

if (externalSource()) {
  provide(MATCH_DETAIL_SOURCE, (_nameTag, matchId) => {
    const data = ref<Awaited<ReturnType<typeof blitzMatchDetail>>>(null)
    const isLoading = ref(true)
    const notFound = ref(false)
    watch(matchId, async (id) => {
      isLoading.value = true
      data.value = await blitzMatchDetail(id).catch(() => null)
      notFound.value = !data.value
      isLoading.value = false
    }, { immediate: true })
    return { data, isLoading, notFound }
  })
}
</script>

<template>
  <SharedPage :eyebrow="t('app.page.drafttools')" :title="t('app.page.jev')">
    <PageMatchup>
      <template #advice="{ championId, request }">
        <JevBuildAdvice :champion-id="championId" :request="request" />
      </template>
    </PageMatchup>
  </SharedPage>
</template>

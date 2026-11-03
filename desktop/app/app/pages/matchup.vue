<!-- The site's matchup page, the same component (`web/layers/common`, #1732):
     only the frame is the app's (`SharedPage`). With another source picked in
     Settings, the games behind the numbers are Blitz's (`utils/sources/composition.ts`),
     and an opened one is read from Blitz too. Above the recommendation, the
     same build-for-this-draft card as champion select (`DraftBuildAdvice`). -->
<script setup lang="ts">
import { MATCH_DETAIL_SOURCE } from '#common/utils/match-detail-source'
import { blitzMatchDetail } from '~/utils/blitz/match-detail'
import DraftBuildAdvice from '~/components/draft/DraftBuildAdvice.vue'

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
  <SharedPage :eyebrow="t('app.page.drafttools')" :title="t('app.page.matchup')">
    <PageMatchup>
      <template #advice="{ championId, request }">
        <DraftBuildAdvice :champion-id="championId" :request="request" />
      </template>
    </PageMatchup>
  </SharedPage>
</template>

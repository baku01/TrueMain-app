<!-- The site's matchup page, the same component (`web/layers/common`, #1732):
     only the frame is the app's (`SharedPage`). -->
<script setup lang="ts">
const { t } = useT()
</script>

<template>
  <SharedPage :eyebrow="t('app.page.drafttools')" :title="t('app.page.matchup')">
    <PageMatchup />
  </SharedPage>
</template>

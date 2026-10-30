<!-- The site's truemains leaderboard, the same component (`web/layers/common`,
     #1732): only the frame is the app's (`SharedPage`). -->
<script setup lang="ts">
const { t } = useT()
</script>

<template>
  <SharedPage :eyebrow="t('app.page.leaderboard')" :title="t('app.page.truemains')">
    <PageTruemains />
  </SharedPage>
</template>

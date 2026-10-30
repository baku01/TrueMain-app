<!-- The site's champion directory, the same component (`web/layers/common`,
     #1732): only the frame is the app's (`SharedPage`). -->
<script setup lang="ts">
const { t } = useT()
</script>

<template>
  <SharedPage :eyebrow="t('app.page.buildsStats')" :title="t('app.page.champions')">
    <PageChampions />
  </SharedPage>
</template>

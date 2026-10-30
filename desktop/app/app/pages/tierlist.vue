<!-- The site's tier list, the same component (`web/layers/common`, #1732): only
     the frame is the app's (`SharedPage`). -->
<script setup lang="ts">
const { t } = useT()
</script>

<template>
  <SharedPage :eyebrow="t('app.page.meta')" :title="t('app.page.tierlist')">
    <PageTierList class="tier-minimal" />
  </SharedPage>
</template>

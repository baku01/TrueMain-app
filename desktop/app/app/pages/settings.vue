<script setup lang="ts">
/**
 * Settings: where the numbers come from (`SettingsDataSource`) and how the
 * window draws (`SettingsGraphics`). The app reads players by Riot ID through
 * Blitz (the Player page), so there is no Riot API key to keep here.
 */
const { t } = useT()
</script>

<template>
  <SharedPage :eyebrow="t('settings.eyebrow')" :title="t('settings.title')">
    <div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader :eyebrow="t('settings.eyebrow')" :title="t('settings.title')" />
      <SettingsDataSource />
      <SettingsAutoImport />
      <SettingsGraphics />
      <!-- Riot's legal notice: here, once, rather than at every page's foot. -->
      <RiotDisclaimer compact class="pt-2 text-center" />
    </div>
  </SharedPage>
</template>

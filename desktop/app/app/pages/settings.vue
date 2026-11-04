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
    <div class="mx-auto tm-narrow space-y-5 p-6">
      <PageHeader :eyebrow="t('settings.eyebrow')" :title="t('settings.title')" />
      <SettingsDataSource />
      <SettingsDataWindow />
      <SettingsAutoImport />
      <SettingsGraphics />
      <!-- Riot's legal notice: here, once, rather than at every page's foot. -->
      <RiotDisclaimer compact class="pt-2 text-center" />
      <!-- Game Icons' licence (CC BY 3.0) asks for the credit. -->
      <p class="text-center text-[11px] text-dimmed">{{ t('settings.iconsCredit') }} <a href="https://game-icons.net" target="_blank" rel="noopener" class="underline hover:text-muted">game-icons.net</a> (CC BY 3.0)</p>
    </div>
  </SharedPage>
</template>

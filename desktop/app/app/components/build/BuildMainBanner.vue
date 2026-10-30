<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import type { ProfileIdentity } from '#shared/types/profile'
import { getProfileIconUrl } from '#shared/utils/ddragon'

/** Whose build the view shows, when it is a true main's: their icon, the sample, and their profile on the site. */
defineProps<{
  identity: ProfileIdentity
  nameTag: string
  games: number
  /** Where their build was read, when it is not the slice asked for. */
  scope: string | null
}>()

const { t } = useT()
const { patch } = useChampionStatics()
/** The title around the name, in the language's word order: the name is drawn between the two halves. */
const [titleBefore, titleAfter] = t('build.main.title', { name: '\u0001' }).split('\u0001')
</script>

<template>
  <div class="flex items-center gap-2.5 rounded-lg bg-elevated/60 py-1.5 pl-1.5 pr-1">
    <SkeletonImage
      :src="getProfileIconUrl(identity.profileIconId, patch)"
      :alt="identity.gameName"
      width="28"
      height="28"
      class="size-7 shrink-0 rounded-md"
    />
    <p class="min-w-0 flex-1 truncate text-[13px] leading-tight">
      <span v-if="titleBefore" class="text-muted">{{ titleBefore }}</span>
      <span class="font-semibold text-highlighted">{{ identity.gameName }}</span>
      <span v-if="titleAfter" class="text-muted">{{ titleAfter }}</span>
      <span class="ml-2 text-[11px] tabular-nums text-dimmed">{{ t('build.games', { count: formatCount(games) }) }}{{ scope ? ` · ${scope}` : '' }}</span>
    </p>
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      trailing-icon="i-lucide-external-link"
      :label="t('build.main.profile')"
      @click="openOnSite(`/truemains/${encodeURIComponent(nameTag)}`)"
    />
  </div>
</template>

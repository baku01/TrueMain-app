<script setup lang="ts">
/**
 * The phone link (`usePhoneLink`): a switch, off until the player turns it on
 * (the app then listens on the network, and the system may ask about it); a
 * QR code the TrueMain phone app scans to pair; the phones paired, each
 * forgettable, and a way to forget them all and change this computer's key.
 */
import { getActiveLocale } from '#common/utils/i18n'

const { t } = useT()
const { status, invite, busy, load, follow, setEnabled, showInvite, hideInvite, forget, reset } = usePhoneLink()

const svgUrl = computed(() => invite.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(invite.value.svg)}` : null)
const remaining = ref(0)
const totalSeconds = ref(1)
const copied = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const progressPct = computed(() => Math.max(0, Math.min(100, (remaining.value / Math.max(1, totalSeconds.value)) * 100)))

watch(invite, (next) => {
  clearInterval(timer)
  copied.value = false
  if (!next) return
  totalSeconds.value = Math.max(1, next.expiresInSeconds)
  remaining.value = next.expiresInSeconds
  timer = setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) hideInvite()
  }, 1000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(copiedTimer)
})

async function copyLink() {
  if (!invite.value?.uri) return
  await navigator.clipboard?.writeText(invite.value.uri).catch(() => {})
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}

function seen(seconds: number) {
  return new Intl.DateTimeFormat(getActiveLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(seconds * 1000)
}

follow()
onMounted(load)
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5" data-phone-link>
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-smartphone" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('phoneLink.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('phoneLink.description') }}</p>
    </header>

    <USwitch
      :model-value="status?.enabled ?? false"
      :disabled="!status || busy"
      :label="t('phoneLink.enable')"
      :description="t('phoneLink.enableDescription')"
      @update:model-value="setEnabled($event)"
    />

    <template v-if="status?.enabled">
      <p v-if="status.error" class="text-xs text-error">{{ t('phoneLink.portError', { port: status.port, error: status.error }) }}</p>

      <div v-if="invite && svgUrl" class="flex flex-wrap items-start gap-5 surface rounded-lg p-4">
        <img :src="svgUrl" :alt="t('phoneLink.qrAlt')" class="size-44 rounded-lg bg-white p-2.5 shadow-sm">
        <div class="min-w-0 flex-1 space-y-2.5 text-sm">
          <p class="font-display font-semibold text-highlighted">{{ t('phoneLink.scanTitle') }}</p>
          <ol class="list-decimal space-y-1 pl-4 text-xs text-muted">
            <li>{{ t('phoneLink.step1') }}</li>
            <li>{{ t('phoneLink.step2') }}</li>
            <li>{{ t('phoneLink.step3') }}</li>
          </ol>
          <div class="space-y-1.5">
            <p class="tabular-nums text-xs text-dimmed">{{ t('phoneLink.expires', { seconds: remaining }) }}</p>
            <div class="h-1 w-full max-w-xs overflow-hidden rounded-full bg-accented">
              <div class="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" :style="{ width: `${progressPct}%` }" />
            </div>
          </div>
          <p v-if="!invite.addresses.length" class="text-xs text-warning">{{ t('phoneLink.noNetwork') }}</p>
          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? t('phoneLink.copied') : t('phoneLink.copyLink')"
              @click="copyLink"
            />
            <UButton size="xs" color="neutral" variant="ghost" :label="t('phoneLink.hide')" @click="hideInvite" />
          </div>
        </div>
      </div>
      <UButton
        v-else
        icon="i-lucide-qr-code"
        :label="t('phoneLink.pair')"
        :disabled="busy || !status.listening"
        @click="showInvite"
      />

      <div class="space-y-2">
        <h3 class="stat-label">{{ t('phoneLink.phones') }}</h3>
        <p v-if="!status.phones.length" class="text-xs text-muted">{{ t('phoneLink.noPhones') }}</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="phone in status.phones" :key="phone.phoneId" class="flex items-center gap-3 py-2.5">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accented">
              <UIcon :name="phone.platform === 'ios' ? 'i-lucide-tablet-smartphone' : 'i-lucide-smartphone'" class="size-4 text-muted" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-highlighted">{{ phone.name }}</p>
              <p class="text-xs text-dimmed">
                {{ phone.online ? t('phoneLink.online') : t('phoneLink.lastSeen', { date: seen(phone.lastSeenAt) }) }}
              </p>
            </div>
            <UBadge v-if="phone.online" color="success" variant="soft" size="sm" :label="t('phoneLink.connected')" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('phoneLink.forget')" :disabled="busy" @click="forget(phone.phoneId)" />
          </li>
        </ul>
        <UButton
          v-if="status.phones.length"
          size="xs"
          color="error"
          variant="ghost"
          :label="t('phoneLink.reset')"
          :disabled="busy"
          @click="reset"
        />
      </div>
    </template>
  </section>
</template>

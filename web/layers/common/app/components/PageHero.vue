<script setup lang="ts">
/**
 * The banner a detail page opens on — the desktop dashboard's (#1682), shared:
 * a splash art under two scrims (left for the title, bottom for the tiles), the
 * subject's portrait and name, actions in the top-right corner, and a row of
 * `KpiTile`s (`flush`) in the default slot, one strip of four (two rows on a phone).
 *
 * The host resolves `splashUrl` (the site through its image proxy, the app
 * straight from Data Dragon), so this component never asks which app it runs in.
 *
 * The art is framed the way the genre's apps do it: anchored right, sized by
 * the band's height rather than stretched across its width — a wide, short
 * band cropped to cover shows a strip of the eyes and nothing else — so the
 * whole width of the art shows, the character's head and shoulders in view,
 * fading out to the left under the title.
 *
 * `on-art` marks the band as dark whatever the theme: the site is dark-only and
 * ignores it, the desktop app's light theme reads it to keep the text over the
 * splash light (`desktop/app/app/assets/css/main.css`).
 */
const props = withDefaults(defineProps<{
  splashUrl?: string | null
  /**
   * Where the art's subject sits, as an `object-position`: its vertical part
   * places the art up or down in the band (`20%` shows its upper part).
   */
  splashPosition?: string
}>(), { splashUrl: null, splashPosition: '68% 22%' })

/** The art is twice the band's height: shift it up by part of the slack, per the position's vertical share. */
const artTop = computed(() => {
  const vertical = Number.parseFloat(props.splashPosition.split(/\s+/)[1] ?? '22')
  return `${-Math.min(100, Math.max(0, Number.isFinite(vertical) ? vertical : 22))}%`
})
</script>

<template>
  <section class="on-art relative overflow-hidden rounded-lg border border-default bg-ink-950">
    <div
      v-if="splashUrl"
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <img
        :src="splashUrl"
        alt=""
        decoding="async"
        class="absolute right-0 h-[200%] w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,black_35%)]"
        :style="{ top: artTop }"
      >
    </div>
    <div class="pointer-events-none absolute inset-0 bg-linear-to-r from-ink-950/85 via-ink-950/30 to-transparent" />
    <div class="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-950 via-ink-950/40 to-transparent" />

    <div class="relative flex flex-col gap-5 p-4 pt-5">
      <div class="flex items-center gap-4">
        <!-- `#identity` draws the portrait and the title block as one: a
             player's profile hands them to `Account`. -->
        <slot name="identity">
          <slot name="portrait" />
          <div class="min-w-0 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
            <slot name="title" />
            <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <slot name="subtitle" />
            </div>
          </div>
        </slot>
        <div
          v-if="$slots.actions"
          class="ml-auto flex items-center gap-2 self-start"
        >
          <slot name="actions" />
        </div>
      </div>
      <!-- The figures as one strip, cells split by hairlines (Blitz's way): the tiles drawn `flush`. -->
      <div
        v-if="$slots.default"
        class="grid grid-cols-2 overflow-hidden rounded-lg bg-ink-950/55 ring-1 ring-white/5 backdrop-blur-md sm:grid-cols-4 sm:divide-x sm:divide-white/5"
      >
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Placeholder of `MatchRow`: the same tile — the portrait, the title line over
// the game's line, the compositions on the right — at the same @container
// tiers, so a list does not jump a size when the games resolve.
</script>

<template>
  <article class="@container surface overflow-hidden rounded-xl" aria-hidden="true">
    <div class="flex items-center gap-3 py-2.5 pl-3 pr-2 @sm:gap-4 @sm:pl-4 @sm:pr-3">
      <USkeleton class="size-12 shrink-0 rounded-lg" />
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="flex h-5 items-center gap-2">
          <USkeleton class="h-3.5 w-14" />
          <USkeleton class="hidden h-3 w-24 @[30rem]:block" />
          <USkeleton class="ml-auto hidden h-3 w-16 @[26rem]:block" />
        </div>
        <div class="flex items-center gap-3 @sm:gap-4">
          <div class="flex shrink-0 items-center gap-1">
            <div class="flex flex-col gap-0.5">
              <USkeleton class="size-[18px] rounded" />
              <USkeleton class="size-[18px] rounded" />
            </div>
            <div class="flex flex-col items-center gap-0.5">
              <USkeleton class="size-[18px] rounded-full" />
              <USkeleton class="size-3.5 rounded-full" />
            </div>
            <USkeleton class="ml-0.5 h-[52px] w-[98px] rounded-lg" />
          </div>
          <div class="w-[4.5rem] shrink-0 space-y-1">
            <USkeleton class="h-3.5 w-16" />
            <USkeleton class="h-2.5 w-12" />
          </div>
          <div class="hidden w-14 shrink-0 space-y-1 @[33rem]:block">
            <USkeleton class="h-3.5 w-12" />
            <USkeleton class="h-2.5 w-10" />
          </div>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1.5 @sm:gap-3">
        <div class="hidden flex-col gap-0.5 @[29rem]:flex">
          <div v-for="side in 2" :key="side" class="flex gap-0.5">
            <USkeleton v-for="i in 5" :key="i" class="size-4 rounded-sm" />
          </div>
        </div>
        <USkeleton class="size-5 rounded-full" />
      </div>
    </div>
  </article>
</template>

<template>
  <div class="w-full">
    <!-- The streak leads, because it is the one number people are keeping -->
    <div class="mx-4 mb-4 rounded-md-lg bg-md-surface-2 px-4 py-4 flex items-center gap-4">
      <div class="h-14 w-14 shrink-0 rounded-md-full flex items-center justify-center" :class="streak.current ? 'bg-md-primary text-md-on-primary' : 'bg-md-surface-4 text-md-on-surface-variant'">
        <span class="material-symbols text-3xl">local_fire_department</span>
      </div>
      <div class="min-w-0">
        <p class="text-md-title-l text-md-on-surface font-semibold leading-none">
          {{ formatNumber(streak.current) }} <span class="text-md-body-m font-normal text-md-on-surface-variant">{{ streak.current === 1 ? 'day' : 'days' }}</span>
        </p>
        <p class="text-md-body-s text-md-on-surface-variant mt-1">
          <template v-if="streak.current">Current streak · best {{ formatNumber(streak.longest) }}</template>
          <template v-else-if="streak.longest">No streak right now · best {{ formatNumber(streak.longest) }}</template>
          <template v-else>Listen two days running to start a streak</template>
        </p>
      </div>
    </div>

    <!-- What to aim at next -->
    <div v-if="next" class="mx-4 mb-5 rounded-md-lg bg-md-surface-1 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="material-symbols text-2xl text-md-on-surface-variant shrink-0">{{ next.icon }}</span>
        <div class="min-w-0 flex-1">
          <p class="text-md-label-l text-md-on-surface truncate">{{ next.title }}</p>
          <p class="text-md-body-s text-md-on-surface-variant">{{ next.description }}</p>
        </div>
        <p class="text-md-label-m text-md-on-surface-variant tabular-nums shrink-0">{{ formatNumber(next.value) }} / {{ formatNumber(next.threshold) }}</p>
      </div>
      <div class="w-full h-1.5 rounded-md-full bg-md-surface-4 overflow-hidden mt-2.5">
        <div class="h-full bg-md-primary rounded-md-full transition-all duration-500" :style="{ width: `${Math.round(next.progress * 100)}%` }" />
      </div>
    </div>

    <div class="px-4 flex items-baseline justify-between mb-2">
      <h2 class="text-md-title-m text-md-on-surface">Badges</h2>
      <p class="text-md-label-m text-md-on-surface-variant tabular-nums">{{ earned.length }} / {{ evaluated.length }}</p>
    </div>

    <!-- Earned first, then the rest dimmed: a locked badge is the point of a badge wall, so it is
         shown rather than hidden, but it must not compete with the ones actually won -->
    <div class="px-4 grid grid-cols-3 gap-3 pb-2">
      <div v-for="tier in ordered" :key="tier.id" class="rounded-md-md px-2 py-3 flex flex-col items-center text-center gap-1.5" :class="tier.earned ? 'bg-md-secondary-container' : 'bg-md-surface-1 opacity-50'">
        <span class="material-symbols text-2xl leading-none" :class="tier.earned ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant'">{{ tier.earned ? tier.icon : 'lock' }}</span>
        <p class="text-md-label-s leading-tight" :class="tier.earned ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant'">{{ tier.title }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { earnedAchievements, evaluateAchievements, nextAchievement, type ListeningSummary, type ListeningStreak } from '~/composables/useAchievements'
import { formatNumber } from '~/composables/useStrings'

const props = defineProps<{
  summary: ListeningSummary
  streak: ListeningStreak
}>()

const evaluated = computed(() => evaluateAchievements(props.summary))
const earned = computed(() => earnedAchievements(evaluated.value))
const next = computed(() => nextAchievement(evaluated.value))

// Earned badges first, each group keeping the ladder's own order so a metric's tiers stay together
const ordered = computed(() => [...evaluated.value].sort((a, b) => Number(b.earned) - Number(a.earned)))
</script>

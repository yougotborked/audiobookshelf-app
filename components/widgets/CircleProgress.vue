<template>
  <div ref="progressbar" class="progressbar">
    <svg class="progressbar__svg">
      <circle cx="20" cy="20" r="17.5" ref="circle" class="progressbar__svg-circle circle-anim"></circle>
      <circle cx="20" cy="20" r="17.5" class="progressbar__svg-circlebg"></circle>
    </svg>
    <p class="progressbar__text text-sm text-warning">{{ count }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  value?: number
  count?: number
}>()

const progressbar = ref<HTMLElement | null>(null)
const circle = ref<SVGCircleElement | null>(null)
let lastProgress = 0
let updateTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => props.value, () => {
  updateProgress()
})

function updateProgress() {
  if (!progressbar.value || !circle.value) return

  if (updateTimeout) clearTimeout(updateTimeout)
  const progress = Math.min(props.value || 0, 1)

  progressbar.value.style.setProperty('--progress-percent-before', String(lastProgress))
  progressbar.value.style.setProperty('--progress-percent', String(progress))

  lastProgress = progress
  circle.value.classList.remove('circle-static')
  circle.value.classList.add('circle-anim')
  updateTimeout = setTimeout(() => {
    circle.value?.classList.remove('circle-anim')
    circle.value?.classList.add('circle-static')
  }, 500)
}
</script>

<style scoped>
/* https://codepen.io/alvarotrigo/pen/VwMvydQ */
.progressbar {
  position: relative;
  width: 42.5px;
  height: 42.5px;
  margin: 0.25em;
  transform: rotate(-90deg);
  box-sizing: border-box;
  --progress-percent-before: 0;
  --progress-percent: 0;
}

.progressbar__svg {
  position: relative;
  width: 100%;
  height: 100%;
}

.progressbar__svg-circlebg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke-width: 4;
  /* stroke-dasharray: 110;
  stroke-dashoffset: 110; */
  stroke: #fb8c0022;
  stroke-linecap: round;
  transform: translate(2px, 2px);
}

.progressbar__svg-circle {
  width: 100%;
  height: 100%;
  fill: none;
  stroke-width: 4;
  stroke-dasharray: 110;
  stroke-dashoffset: 110;
  /* stroke: hsl(0, 0%, 100%); */
  stroke: #fb8c00;
  stroke-linecap: round;
  transform: translate(2px, 2px);
}

.circle-anim {
  animation: anim_circle 0.5s ease-in-out forwards;
}

.circle-static {
  stroke-dashoffset: calc(110px - (110px * var(--progress-percent)));
}

@keyframes anim_circle {
  from {
    stroke-dashoffset: calc(110px - (110px * var(--progress-percent-before)));
  }
  to {
    stroke-dashoffset: calc(110px - (110px * var(--progress-percent)));
  }
}

.progressbar__text {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-top: 1px;
  transform: translate(-50%, -50%) rotate(90deg);
  animation: bounce 0.75s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translate(-35%, -50%) rotate(90deg);
    -webkit-animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translate(-50%, -50%) rotate(90deg);
    -webkit-animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
</style>
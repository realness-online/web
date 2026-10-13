<script setup>
  import { computed } from 'vue'
  import { startup_stages } from '../../../harness/startup.js'

  const props = defineProps({
    problem: { type: String, default: '' },
    progress: { type: Object, default: null }
  })
  const emit = defineEmits(['retry'])
  const MS_PER_SECOND = 1000
  const label = computed(() => {
    const stage = props.progress?.stage
    if (typeof stage !== 'string' || !Object.hasOwn(startup_stages, stage))
      return 'Connecting...'
    const name = startup_stages[stage]
    if (props.progress.state === 'failed') return `${name} failed`
    if (props.progress.state === 'complete') return `${name} complete`
    return name
  })
  const duration = computed(() => {
    const ms = props.progress?.ms
    return Number.isFinite(ms) && ms >= 0
      ? (ms / MS_PER_SECOND).toFixed(1)
      : null
  })
  const seconds = computed(() => {
    const elapsed = props.progress?.elapsed_ms
    return Number.isFinite(elapsed) && elapsed >= 0
      ? (elapsed / MS_PER_SECOND).toFixed(1)
      : null
  })
</script>

<template>
  <section aria-label="Connection status" :aria-busy="!problem || undefined">
    <p v-if="problem" role="alert">{{ problem }}</p>
    <p v-else :role="progress?.state === 'failed' ? 'alert' : 'status'">
      {{ label }}
    </p>
    <time
      v-if="seconds !== null"
      :datetime="`PT${seconds}S`"
      title="Elapsed at last reported stage"
      >{{ seconds }} s reported</time
    >
    <time
      v-if="duration !== null"
      :datetime="`PT${duration}S`"
      title="Stage duration"
      >{{ duration }} s in this step</time
    >
    <button v-if="problem" type="button" @click="emit('retry')">Retry</button>
  </section>
</template>

<style lang="stylus">
  section[aria-label='Connection status'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: base-line;
    min-block-size: 0;
    padding: base-line;
    text-align: center;
    background: var(--surface);
    & > time {
      color: var(--text);
    }
    & > p {
      margin: 0;
      max-inline-size: none;
      &[role='alert'] {
        color: var(--warning);
      }
    }
  }
</style>

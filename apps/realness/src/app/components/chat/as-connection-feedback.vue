<script setup>
  import {
    computed,
    onBeforeUnmount as on_before_unmount,
    ref,
    watch
  } from 'vue'
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
    return name
  })
  const now = ref(Date.now())
  const received_at = ref(Date.now())
  watch(
    () => props.progress,
    () => {
      received_at.value = Date.now()
      now.value = received_at.value
    }
  )
  const timer = setInterval(() => {
    now.value = Date.now()
  }, MS_PER_SECOND)
  on_before_unmount(() => clearInterval(timer))
  const seconds = computed(() => {
    const reported = props.progress?.elapsed_ms
    const elapsed = Number.isFinite(reported) && reported >= 0 ? reported : 0
    const waiting = props.problem ? 0 : now.value - received_at.value
    return Math.floor((elapsed + waiting) / MS_PER_SECOND)
  })
</script>

<template>
  <section aria-label="Connection status" :aria-busy="!problem || undefined">
    <p v-if="problem" role="alert">{{ problem }}</p>
    <p v-else :role="progress?.state === 'failed' ? 'alert' : 'status'">
      {{ label }}
    </p>
    <time :datetime="`PT${seconds}S`">{{ seconds }} s</time>
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

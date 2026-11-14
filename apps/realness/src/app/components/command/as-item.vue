<template>
  <li itemscope itemtype="https://schema.org/HowTo">
    <header>
      <h3 itemprop="name">{{ command.title }}</h3>
      <span>{{ command.kind }}</span>
    </header>
    <p>
      <strong>{{ command.review }}</strong> - {{ command.note }}
    </p>
    <p>
      <code itemprop="step">{{ command.command }}</code>
      <button type="button" :value="command.command" @click="copy">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </p>
    <details>
      <summary>Source and details</summary>
      <p v-for="(line, index) in command.details" :key="index">{{ line }}</p>
    </details>
  </li>
</template>

<script setup>
  import { onUnmounted as on_unmounted, ref } from 'vue'

  const props = defineProps({
    command: { type: Object, required: true }
  })

  const COPIED_MS = 2000
  const copied = ref(false)
  let timer = null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.command.command)
    } catch {
      return
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, COPIED_MS)
  }

  on_unmounted(() => clearTimeout(timer))
</script>

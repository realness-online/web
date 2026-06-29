<script setup>
  import { ref, computed } from 'vue'
  import poster_prompt from '@/content/agent-prompt-poster.md?raw'
  import instance_prompt from '@/content/agent-prompt-instance.md?raw'

  defineOptions({ name: 'AsPromptAgent' })

  const props = defineProps({
    mode: {
      type: String,
      default: 'poster',
      validator: v => ['poster', 'instance'].includes(v)
    },
    inline: {
      type: Boolean,
      default: false
    }
  })

  const copy_feedback_ms = 2000
  const copied = ref(false)

  const prompt = computed(() =>
    props.mode === 'instance' ? instance_prompt : poster_prompt
  )

  const label = computed(() =>
    props.mode === 'instance'
      ? {
          heading: 'Prompt an agent',
          desc: 'Copy a ready-made prompt to give an AI agent. Paste it into Cursor, Claude Code, or any coding assistant — it will know how to guide you through deploying your own Realness instance.',
          button: 'Copy instance prompt'
        }
      : {
          heading: 'Prompt an agent',
          desc: 'Copy a ready-made prompt to give an AI agent. Paste it into Cursor, Claude Code, or any coding assistant — it will know how to guide you through creating a Realness poster.',
          button: 'Copy poster prompt'
        }
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.value)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, copy_feedback_ms)
    } catch {
      // fallback: select the text area
    }
  }
</script>

<template>
  <button v-if="inline" type="button" class="prompt-agent inline" @click="copy">
    {{ copied ? 'Copied' : 'Copy prompt' }}
  </button>
  <section v-else class="prompt-agent">
    <h3>{{ label.heading }}</h3>
    <p>{{ label.desc }}</p>
    <button type="button" @click="copy">
      {{ copied ? 'Copied!' : label.button }}
    </button>
  </section>
</template>

<style lang="stylus">
  section.prompt-agent
    margin: base-line * 2 auto
    max-width: base-line * 26
    padding: base-line
    border: 1px solid var(--blue)
    border-radius: base-line * 0.5
    text-align: center

    & > h3
      margin: 0 0 base-line * 0.5
      color: var(--blue)

    & > p
      margin: 0 0 base-line
      font-size: 0.9em
      line-height: 1.5
      opacity: 0.85

    & > button
      padding: base-line * 0.5 base-line * 1.5
      border: 1px solid var(--red)
      border-radius: base-line * 0.33
      background: none
      color: var(--red)
      cursor: pointer
      font: inherit

      &:hover,
      &:focus-visible
        background: var(--red)
        color: white
</style>

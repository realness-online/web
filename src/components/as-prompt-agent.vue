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

  const on_copy = async () => {
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
  <button v-if="inline" type="button" @click="on_copy">
    {{ copied ? 'Copied' : 'Copy prompt' }}
  </button>
  <section v-else data-prompt-agent>
    <h3>{{ label.heading }}</h3>
    <p>{{ label.desc }}</p>
    <button type="button" @click="on_copy">
      {{ copied ? 'Copied!' : label.button }}
    </button>
  </section>
</template>

<style>
  section[data-prompt-agent] {
    margin: calc(var(--base-line) * 2) auto;
    max-width: calc(var(--base-line) * 26);
    padding: var(--base-line);
    border: 1px solid var(--accent);
    border-radius: calc(var(--base-line) * 0.5);
    text-align: center;

    & > h3 {
      margin-top: 0;
      color: var(--accent);
    }

    & > p {
      font-size: 0.9em;
      line-height: 1.5;
      opacity: 0.85;
    }

    & > button {
      padding: calc(var(--base-line) * 0.5) calc(var(--base-line) * 1.5);
      border: 1px solid var(--emphasis);
      border-radius: calc(var(--base-line) * 0.33);
      background: none;
      color: var(--emphasis);
      cursor: pointer;
      font: inherit;

      &:hover,
      &:focus-visible {
        background: var(--emphasis);
        color: var(--contrast);
      }
    }
  }
</style>

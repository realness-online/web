<script setup>
  import { computed } from 'vue'

  const props = defineProps({
    plan: { type: String, default: '' },
    branch: { type: String, default: null },
    branch_level: { type: String, default: 'dim' },
    parts: { type: Array, default: () => [] }
  })
  const shown = computed(() =>
    Boolean(props.plan || props.branch || props.parts.length)
  )
</script>

<template>
  <footer v-if="shown" aria-label="Plan and session">
    <p v-if="plan || branch">
      <span v-if="plan" data-plan>{{ plan }}</span>
      <span v-if="branch" data-branch :data-level="branch_level">
        ({{ branch }})
      </span>
    </p>
    <ul v-if="parts.length">
      <li v-for="part in parts" :key="part.text" :data-level="part.level">
        {{ part.text }}
      </li>
    </ul>
  </footer>
</template>

<style lang="stylus">
  aside#chat-panel > aside[aria-label='Status'] > footer[aria-label='Plan and session'] {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 base-line;
    margin: 0;
    padding: (base-line / 2) base-line;
    line-height: var(--base-line);
    font-size: 0.85em;
    color: var(--muted-text);
    & > p {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    & > p > [data-plan] {
      margin-inline-end: 0.4ch;
    }
    & > ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0 1ch;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    & > p > [data-level='warning'],
    & > ul > [data-level='warning'] {
      color: var(--warning);
    }
    & > p > [data-level='success'] {
      color: var(--accent);
    }
    & > ul > [data-level='error'] {
      color: var(--emphasis);
    }
  }
</style>

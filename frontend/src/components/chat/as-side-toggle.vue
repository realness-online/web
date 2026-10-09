<script setup>
  import { use_home_view } from '@/use/home-view'

  /* In chat's header: beside chat, your thoughts or the terminal. It draws
     what a click brings in. Styled with the speech bubble in as-chat-toggle. */
  const { view, toggle_side } = use_home_view()
</script>

<template>
  <button
    type="button"
    data-side-toggle
    :aria-label="
      view === 'chat-tui'
        ? 'Show your thoughts beside chat'
        : 'Show the terminal beside chat'
    "
    :title="view === 'chat-tui' ? 'Thoughts' : 'Terminal'"
    @click="toggle_side">
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect x="0.75" y="0.75" width="14.5" height="10.5" rx="2" />
      <template v-if="view === 'chat-tui'">
        <line x1="4" y1="4.5" x2="12" y2="4.5" />
        <line x1="4" y1="7.5" x2="9.5" y2="7.5" />
      </template>
      <template v-else>
        <polyline points="4,4 6,6 4,8" />
        <line x1="7.5" y1="8" x2="11" y2="8" />
      </template>
    </svg>
  </button>
</template>

<script setup>
  import { use_home_view } from '@/use/home-view'

  /* The speech bubble: side chat on or off, beside whatever else shows. */
  const { shows, toggle_chat } = use_home_view()
</script>

<template>
  <button
    type="button"
    data-chat-toggle
    :aria-pressed="String(shows.chat)"
    :aria-label="shows.chat ? 'Close chat' : 'Open chat'"
    aria-keyshortcuts="Alt+C"
    :title="`${shows.chat ? 'Close' : 'Open'} chat (Option+C)`"
    @click="toggle_chat">
    <svg viewBox="0 0 16 14" aria-hidden="true">
      <path
        d="M2.5 1.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-3.5 2.5v-2.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
    </svg>
  </button>
</template>

<style lang="stylus">
  button[data-chat-toggle],
  button[data-side-toggle] {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    focus-ring();
    @media (hover: hover) and (pointer: fine) {
      &:hover {
        opacity: 0.85;
      }
    }
    & > svg {
      display: block;
      inline-size: base-line * 1.5;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }
</style>

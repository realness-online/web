<script setup>
  import { use_home_view } from '@/use/home-view'

  const { shows, toggle_chat, chat_toggle_disabled } = use_home_view()
</script>

<template>
  <button
    type="button"
    data-chat-toggle
    :disabled="chat_toggle_disabled"
    :aria-pressed="String(shows.chat)"
    :aria-label="shows.chat ? 'Close chat' : 'Open chat'"
    aria-keyshortcuts="Alt+`"
    :title="(shows.chat ? 'Close' : 'Open') + ' chat (Option+`)'"
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
    font-size: base-line * 1.44;
    block-size: 1.33em;
    display: grid;
    place-items: center;
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
    &:focus {
      outline: none;
    }
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

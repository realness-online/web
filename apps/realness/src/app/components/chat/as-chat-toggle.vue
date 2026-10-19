<script setup>
  import Icon from '@/components/icon.vue'
  import { use_home_view } from '@/use/home-view'

  const { shows, toggle_chat } = use_home_view()
</script>

<template>
  <button
    type="button"
    data-chat-toggle
    tabindex="-1"
    :aria-pressed="String(shows.chat)"
    :aria-label="shows.chat ? 'Close chat' : 'Open chat'"
    aria-keyshortcuts="Alt+`"
    :title="(shows.chat ? 'Close' : 'Open') + ' chat (Option+`)'"
    @click="toggle_chat">
    <icon name="chevron" />
  </button>
</template>

<style lang="stylus">
  button[data-chat-toggle] {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font-size: base-line * 1.44;
    block-size: 1.33em;
    display: grid;
    place-items: center;
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

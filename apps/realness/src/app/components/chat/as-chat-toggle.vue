<script setup>
  import Icon from '@/components/icon.vue'
  import { use_home_view, chat_toggled_at } from '@/use/home-view'
  import { ref, watch } from 'vue'

  const props = defineProps({
    /** Rides inside the chat panel and points west while chat is open. */
    inside: { type: Boolean, default: false }
  })

  const { shows, toggle_chat } = use_home_view()
  const button = ref(null)

  /**
   * Swing the chevron like a saloon door after a real toggle, so a page load
   * stays still. Only the chevron that remains swings: the inside one on open,
   * the outside one when chat closes.
   */
  const EAST = '0deg'
  const WEST = '180deg'
  const EAST_AGAIN = '360deg'
  const SWINGS = {
    opening: [EAST, WEST],
    returning: [WEST, EAST_AGAIN]
  }
  const MS_PER_SECOND = 1000
  const FALLBACK_MS = 1310

  const swing = () => {
    const svg = button.value?.querySelector('svg')
    if (!svg?.animate) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const style = getComputedStyle(svg)
    const name = props.inside ? 'opening' : 'returning'
    const seconds = parseFloat(style.getPropertyValue('--duration-swing'))
    svg.animate(
      SWINGS[name].map(angle => ({ rotate: `y ${angle}` })),
      {
        duration: seconds * MS_PER_SECOND || FALLBACK_MS,
        easing: style.getPropertyValue('--ease-swing').trim() || 'ease-out'
      }
    )
  }
  watch(chat_toggled_at, swing, { flush: 'post' })
</script>

<template>
  <button
    v-if="inside === shows.chat"
    ref="button"
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
    perspective: 4em;
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
      inline-size: base-line * 0.75;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }
  aside#chat-panel > header > button[aria-pressed='true'] > svg {
    rotate: y 180deg;
  }
</style>

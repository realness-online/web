<script setup>
  import { use_chat } from '@/use/chat'
  import { use_home_view } from '@/use/home-view'
  import AsConversation from '@/components/chat/as-conversation.vue'
  import AsFeedToggle from '@/components/thoughts/as-feed-toggle.vue'
  import { only_mine } from '@/utils/preference'
  import {
    nextTick as next_tick,
    onBeforeUnmount as on_before_unmount,
    ref,
    toRef as to_ref,
    watch
  } from 'vue'

  /* Chat on the homepage: the same Pi session as /chat, GUI only. It
     connects the first time it shows and stays connected after, so leaving
     and coming back keeps the conversation where it was. */
  const props = defineProps({
    actor: { type: String, default: null },
    problem: { type: String, default: '' }
  })
  const emit = defineEmits(['leave'])

  const { view, shows } = use_home_view()
  const talk = ref(null)
  const chat = use_chat(to_ref(props, 'actor'), {
    on_change: () => talk.value?.to_end()
  })
  let started = false

  watch(
    () => props.problem,
    problem => {
      if (problem) chat.status.value = problem
    },
    { immediate: true }
  )

  watch(
    () => [shows.value.chat, props.actor],
    async ([open, actor]) => {
      if (!open) return
      if (actor && !started) {
        started = true
        chat.watch()
      }
      await next_tick()
      talk.value?.focus()
      talk.value?.to_end()
    },
    { immediate: true }
  )

  /** Escape leaves chat; Cmd+K clears its view, as in the TUI. */
  const on_key = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      emit('leave')
    }
    if (event.metaKey && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      chat.clear()
    }
  }

  on_before_unmount(() => chat.stop())
</script>

<template>
  <aside
    id="chat-panel"
    aria-label="Chat"
    :data-open="shows.chat || undefined"
    :data-alone="view === 'chat' || undefined"
    :inert="!shows.chat || undefined"
    @keydown="on_key">
    <header>
      <as-feed-toggle v-if="shows.thoughts" v-model="only_mine" />
      <slot />
    </header>
    <as-conversation ref="talk" :chat="chat" />
    <aside aria-label="Status">
      <p role="status">{{ chat.status.value }}</p>
    </aside>
  </aside>
</template>

<style lang="stylus">
  aside#chat-panel {
    // The chat column, as on /chat: page-width.
    chat-width = page-width
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    // Above the app's footer toolbar (9-10): alone, or on a phone, chat
    // covers everything.
    z-index: 11;
    inline-size: 'min(100%, %s)' % chat-width;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    background: var(--surface);
    border-inline-end: 1px solid var(--code-surface);
    // Slides in from the left edge; hidden once it has slid out.
    translate: -100% 0;
    visibility: hidden;
    transition-property: translate, visibility, inline-size, padding-inline;
    transition-duration: var(--duration-subject, 0.3s);
    transition-timing-function: var(--ease-reveal, ease-out);
    &[data-open] {
      translate: 0 0;
      visibility: visible;
    }
    // Alone, chat holds its column at the center of the window.
    &[data-alone] {
      inline-size: 100%;
      padding-inline: 'max(0px, calc((100% - %s) / 2))' % chat-width;
      border-inline-end: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
    & > header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: base-line;
      // Without the community toggle, the view toggle keeps its corner.
      & > :last-child {
        margin-inline-start: auto;
      }
    }
    // As on /chat: the conversation takes the height up to 1440px, and the
    // box under the input takes the rest and holds the status.
    & > ol[data-chat] {
      flex: 10000 1 0;
      min-block-size: 0;
      max-block-size: 1440px;
    }
    & > aside {
      display: block;
      flex: 1 1 0;
      min-block-size: 0;
      margin: 0 base-line base-line;
      border-radius: base-line;
      background: var(--code-surface);
      overflow: auto;
      & > p {
        margin: 0;
        padding: base-line;
      }
    }
  }
  // Beside thoughts on a wide screen, the feed's toolbar centers over the feed.
  @media (min-width: display-begins) {
    :root:has(aside#chat-panel[data-open]:not([data-alone])) footer[data-footer-visible] {
      left: 'calc(50% + %s)' % (page-width / 2);
    }
  }
</style>

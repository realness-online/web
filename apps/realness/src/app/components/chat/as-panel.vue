<script setup>
  import { use_chat } from '@/use/chat'
  import { use_home_view } from '@/use/home-view'
  import AsConnectionFeedback from '@/components/chat/as-connection-feedback.vue'
  import AsConversation from '@/components/chat/as-conversation.vue'
  import AsFeedToggle from '@/components/thoughts/as-feed-toggle.vue'
  import { only_mine, info } from '@/utils/preference'
  import { use_deferred_flag } from '@/use/deferred-unmount'
  import { page_context } from '@/utils/chat-context'
  import {
    computed,
    defineAsyncComponent as define_async_component,
    inject,
    nextTick as next_tick,
    onBeforeUnmount as on_before_unmount,
    ref,
    toRef as to_ref,
    watch
  } from 'vue'
  import { useRoute as use_route } from 'vue-router'

  const props = defineProps({
    actor: { type: String, default: null },
    startup_id: { type: String, default: null }
  })
  const emit = defineEmits(['leave'])

  const AsFps = define_async_component(() => import('@/components/as-fps.vue'))
  const route = use_route()
  const { view, shows } = use_home_view()
  const { mounted: fps_mounted, leaving: fps_leaving } = use_deferred_flag(
    () => info.value && shows.value.chat
  )
  const talk = ref(null)
  const chat = use_chat(to_ref(props, 'actor'), {
    on_change: () => talk.value?.to_end(),
    set_working: inject('set_working', () => {}),
    get_startup_id: () => props.startup_id,
    get_context: () => (route ? page_context(route) : null)
  })
  let started = false

  watch(
    () => [shows.value.chat, props.actor, chat.starting.value],
    async ([open]) => {
      if (!open) return
      if (!started) {
        started = true
        chat.watch()
      }
      await next_tick()
      talk.value?.focus()
      talk.value?.to_end()
    },
    { immediate: true }
  )

  const on_reveal = event => {
    if (event.propertyName === 'visibility' && shows.value.chat)
      talk.value?.focus()
  }

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

  const failed = computed(() => Boolean(chat.connection_problem.value))
  const status_line = computed(() =>
    failed.value || chat.status.value === 'Starting...' ? '' : chat.status.value
  )

  const retry = () => chat.retry()
  on_before_unmount(() => chat.stop())
</script>

<template>
  <aside
    id="chat-panel"
    aria-label="Chat"
    :data-open="shows.chat || undefined"
    :data-alone="view === 'chat' || undefined"
    :inert="!shows.chat || undefined"
    @keydown="on_key"
    @transitionstart.self="on_reveal"
    @transitionend.self="on_reveal">
    <header>
      <as-feed-toggle
        v-if="shows.thoughts && (route?.path ?? '/') === '/'"
        v-model="only_mine" />
      <slot />
    </header>
    <as-conversation ref="talk" :chat="chat" />
    <aside aria-label="Status">
      <as-connection-feedback
        v-if="failed"
        :problem="chat.connection_problem.value"
        :progress="chat.startup_events.value.at(-1)"
        @retry="retry" />
      <p role="status">{{ status_line }}</p>
      <as-fps v-if="fps_mounted" :data-leaving="fps_leaving || undefined" />
    </aside>
  </aside>
</template>

<style lang="stylus">
  aside#chat-panel {
    chat-width = page-width
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 11;
    inline-size: 'min(100%, %s)' % chat-width;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    background: var(--surface);
    border-inline-end: round(base-line * 0.1, 2) solid var(--code-surface);
    translate: -100% 0;
    visibility: hidden;
    transition-property: translate, visibility, inline-size, padding-inline;
    transition-duration: var(--duration-subject, 0.3s);
    transition-timing-function: var(--ease-reveal, ease-out);
    &[data-open] {
      translate: 0 0;
      visibility: visible;
    }
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
      align-items: center;
      justify-content: space-between;
      padding: base-line;
      & > :last-child {
        margin-inline-start: auto;
      }
    }
    & > ol[data-chat] {
      flex: 10000 1 0;
      min-block-size: 0;
      max-block-size: 1440px;
    }
    & > aside {
      display: block;
      container: chat-buffer / size;
      flex: 1 1 0;
      min-block-size: base-line * 4.5;
      margin: 0 base-line base-line;
      border-radius: base-line;
      background: var(--code-surface);
      overflow: auto;
      & > section[aria-label='Connection status'] {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        gap: (base-line / 2) base-line;
        padding: (base-line / 2) base-line;
        text-align: start;
        background: none;
      }
      & > p {
        margin: 0;
        padding: (base-line / 2) base-line;
        &:empty {
          display: none;
        }
      }
    }
  }
  @media (orientation: portrait) {
    aside#chat-panel > aside {
      box-sizing: border-box;
      padding-block: base-line * 0.5;
    }
  }
  @media (orientation: landscape) {
    aside#chat-panel > aside {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 0 0 auto;
      block-size: 'calc(%s + 2px)' % (base-line * 2);
      min-block-size: 'calc(%s + 2px)' % (base-line * 2);
      &:has(> p:not(:empty)), &:has(> section) {
        block-size: auto;
        min-block-size: base-line * 3;
      }
    }
  }
  @media (min-width: display-begins) {
    :root:has(aside#chat-panel[data-open]:not([data-alone])) footer[data-footer-visible] {
      left: 'calc(50% + %s)' % (page-width / 2);
    }
  }
</style>

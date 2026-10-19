<script setup>
  import WorkingBorder from '@/components/working-border.vue'
  import { message_html } from '@/utils/message-markdown'
  import { create_parts } from '@/utils/chat-parts'
  import { matching_commands } from '@/utils/chat-commands'
  import { is_at_end } from '@/utils/chat-scroll'
  import {
    computed,
    inject,
    nextTick as next_tick,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref,
    watch
  } from 'vue'

  const props = defineProps({
    chat: { type: Object, required: true }
  })

  const list = ref(null)
  const input = ref(null)
  /** Reading the newest message, so new ones may follow it. */
  const at_end = ref(true)

  const to_end = async () => {
    await next_tick()
    list.value?.lastElementChild?.scrollIntoView({ block: 'end' })
    at_end.value = true
  }

  const on_scroll = () => {
    if (list.value) at_end.value = is_at_end(list.value)
  }

  const send = () => {
    at_end.value = true
    props.chat.send()
  }

  const draw_parts = create_parts()
  watch(
    () => [
      props.chat.messages.value.length,
      props.chat.messages.value.at(-1)?.text
    ],
    () => {
      if (list.value) draw_parts(list.value)
      if (at_end.value) void to_end()
    },
    { flush: 'post' }
  )
  on_mounted(() => {
    draw_parts(list.value)
    void to_end()
  })

  const key_commands = inject('key-commands', null)
  key_commands?.register_handler('view::Chat_Latest', {
    handler: () => void to_end(),
    context: 'global'
  })
  on_unmounted(() => key_commands?.unregister_handler('view::Chat_Latest'))

  const suggestions = computed(() => matching_commands(props.chat.draft.value))

  const pick = command => {
    props.chat.draft.value = `/${command.name}${command.args ? ' ' : ''}`
    input.value?.focus()
  }

  const on_key = event => {
    if (event.isComposing || event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    send()
  }

  defineExpose({ focus: () => input.value?.focus(), to_end, input })
</script>

<template>
  <ol
    ref="list"
    data-chat
    aria-label="Conversation"
    aria-live="polite"
    @scroll.passive="on_scroll">
    <li
      v-for="(message, index) in chat.messages.value"
      :key="index"
      itemscope
      itemtype="https://schema.org/Message">
      <meta itemprop="sender" :content="message.sender" />
      <section itemprop="text" v-html="message_html(message.text)" />
    </li>
  </ol>
  <form
    data-chat
    :aria-busy="chat.working.value ? 'true' : null"
    @submit.prevent="send">
    <button v-if="!at_end" type="button" data-latest @click="to_end()">
      Newest message
    </button>
    <menu v-if="suggestions.length" aria-label="Commands">
      <li v-for="command in suggestions" :key="command.name">
        <button type="button" @click="pick(command)">
          <kbd>/{{ command.name }}</kbd> {{ command.description }}
        </button>
      </li>
    </menu>
    <working-border :active="chat.working.value" />
    <textarea
      ref="input"
      v-model="chat.draft.value"
      name="message"
      rows="1"
      aria-label="Message"
      required
      @keydown="on_key" />
  </form>
</template>

<style lang="stylus">
  ol[data-chat] {
    margin: 0;
    padding: 0 base-line;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: base-line;
    & > li {
      flex-shrink: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    & > li:first-child {
      margin-block-start: auto;
    }
    & > li:has(> meta[itemprop='sender'][content='You']) > section[itemprop='text'] {
      color: var(--accent);
    }
    & pre {
      max-inline-size: 100%;
      overflow-x: auto;
      overflow-wrap: normal;
    }
    & a[itemprop='url'] > figure {
      margin: 0 0 base-line;
      padding: (base-line / 2) base-line;
      border: round(base-line * 0.1, 2) solid var(--muted-text);
      border-radius: (base-line / 2);
      & > figcaption {
        display: grid;
      }
      & span[itemprop='provider'] {
        color: var(--muted-text);
      }
    }
    & pre.mermaid[aria-busy='true'],
    & pre.cardlink[aria-busy='true'] {
      color: transparent;
      user-select: none;
      min-block-size: base-line * 4;
      border: round(base-line * 0.1, 2) dashed var(--muted-text);
      border-radius: (base-line / 2);
    }
    & pre.mermaid[data-processed] {
      background: none;
      & > svg {
        inline-size: auto;
        block-size: auto;
        max-inline-size: none;
      }
    }
    & > li > section[itemprop='text'] {
      display: grid;
      grid-template-columns: unquote(
        '[wide-start text-start] minmax(0, 50ch) [text-end] minmax(0, 1fr) [wide-end]'
      );
      & > * {
        grid-column: text;
      }
      & > pre,
      & > table {
        grid-column: wide;
      }
      & > :last-child {
        margin-bottom: 0;
      }
    }
    & table {
      display: block;
      max-inline-size: 100%;
      overflow-x: auto;
      border-collapse: collapse;
      margin-block-end: base-line;
      & th,
      & td {
        overflow-wrap: normal;
        min-inline-size: 8ch;
        padding: (base-line / 4) (base-line / 2);
        border-block-end: round(base-line * 0.1, 2) solid var(--muted-text);
        text-align: start;
        vertical-align: top;
      }
    }
  }
  form[data-chat] {
    max-width: none;
    padding: base-line;
    position: relative;
    & > div.working-border {
      position: absolute;
      inset: base-line auto base-line base-line;
      inline-size: 'calc(100% - %s)' % (base-line * 2);
      max-inline-size: page-width;
      border-radius: base-line;
      padding: 2px;
      & > div {
        inset: auto;
        left: 0;
        top: 0;
        width: base-line * 6;
        height: base-line * 1.5;
        background: radial-gradient(closest-side, var(--accent) 40%, transparent);
        offset-path: inset(0 round base-line);
        offset-rotate: 0deg;
        transform: none;
        animation: chat-edge-travel 2.5s linear infinite;
        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }
    }
    & > menu[aria-label='Commands'] {
      list-style: none;
      margin: 0 0 (base-line / 2);
      padding: 0;
      max-width: page-width;
      & button {
        display: block;
        inline-size: 100%;
        text-align: start;
        padding: (base-line / 4) (base-line / 2);
        color: var(--muted-text);
        background: none;
        border: 0;
        &:hover,
        &:focus-visible {
          color: var(--text);
        }
      }
      & kbd {
        font: inherit;
        color: var(--accent);
      }
    }
    & > button[data-latest] {
      position: absolute;
      inset-block-end: 100%;
      inset-inline-end: base-line;
      margin-block-end: (base-line / 2);
      padding: (base-line / 4) base-line;
      border: round(base-line * 0.1, 2) solid var(--emphasis);
      border-radius: base-line;
      color: var(--text);
      background: var(--surface);
    }
    & > textarea {
      box-sizing: border-box;
      inline-size: 100%;
      max-width: page-width;
      line-height: base-line;
      padding: (base-line / 2) base-line;
      border: round(base-line * 0.1, 2) solid var(--emphasis);
      border-radius: base-line;
      color: var(--text);
      caret-color: var(--text);
      resize: none;
      field-sizing: content;
      min-block-size: base-line * 2;
      max-block-size: 33dvh;
      overflow-y: auto;
    }

  }
</style>

<style>
  @keyframes chat-edge-travel {
    from {
      offset-distance: 0%;
    }
    to {
      offset-distance: 100%;
    }
  }
</style>

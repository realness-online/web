<script setup>
  import WorkingBorder from '@/components/working-border.vue'
  import { message_html } from '@/utils/message-markdown'
  import { create_parts } from '@/utils/chat-parts'
  import { matching_commands } from '@/utils/chat-commands'
  import { is_at_end, is_far_from_end } from '@/utils/chat-scroll'
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
  /** A screen or more above the newest message: show the jump. */
  const far = ref(false)

  const to_end = async () => {
    await next_tick()
    list.value?.lastElementChild?.scrollIntoView({ block: 'end' })
    at_end.value = true
    far.value = false
  }

  const on_scroll = () => {
    if (!list.value) return
    at_end.value = is_at_end(list.value)
    far.value = is_far_from_end(list.value)
  }

  const send = () => {
    at_end.value = true
    far.value = false
    props.chat.send()
  }

  const draw_parts = create_parts()
  watch(
    () => [
      props.chat.messages.value.length,
      props.chat.messages.value.at(-1)?.text,
      props.chat.messages.value.at(-1)?.thinking
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
  /** Ctrl+End returns to the newest message, as in the TUI. */
  const on_latest_key = event => {
    if (at_end.value || !event.ctrlKey || event.key !== 'End') return
    event.preventDefault()
    void to_end()
  }
  on_mounted(() => window.addEventListener('keydown', on_latest_key))
  on_unmounted(() => {
    window.removeEventListener('keydown', on_latest_key)
    key_commands?.unregister_handler('view::Chat_Latest')
  })

  const suggestions = computed(() => matching_commands(props.chat.draft.value))

  const pick = command => {
    props.chat.draft.value = `/${command.name}${command.args ? ' ' : ''}`
    input.value?.focus()
  }

  /** Every Thinking block opens and closes together. */
  const thinking_open = ref(false)

  /** Where ↑ has reached in what this person sent; null is the unsent draft. */
  const recalled = ref(null)
  let unsent = ''
  const sent = () =>
    props.chat.messages.value
      .filter(message => message.sender === 'You')
      .map(message => message.text)

  /**
   * Step through earlier inputs, as in a shell. Only from the first or last
   * line, so arrows still move inside a multiline draft.
   * @param {KeyboardEvent} event
   * @param {-1 | 1} step
   */
  const recall = (event, step) => {
    const field = event.target
    const draft = props.chat.draft.value
    const edge =
      step < 0
        ? !draft.slice(0, field.selectionStart).includes('\n')
        : !draft.slice(field.selectionEnd).includes('\n')
    const inputs = sent()
    if (!edge || (recalled.value === null && step > 0) || !inputs.length) return
    event.preventDefault()
    if (recalled.value === null) unsent = draft
    const next = (recalled.value ?? inputs.length) + step
    if (next < 0) return
    recalled.value = next >= inputs.length ? null : next
    props.chat.draft.value =
      recalled.value === null ? unsent : inputs[recalled.value]
  }

  const on_key = event => {
    if (event.isComposing) return
    if (event.key === 'Tab' && !event.shiftKey && suggestions.value.length) {
      event.preventDefault()
      return pick(suggestions.value[0])
    }
    if (event.key === 'ArrowUp') return recall(event, -1)
    if (event.key === 'ArrowDown') return recall(event, 1)
    if (event.key !== 'Enter') return
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    recalled.value = null
    send()
  }

  /** Leaving the field sends what it holds, as a thought saves. */
  const on_leave = event => {
    if (event.currentTarget.form?.contains(event.relatedTarget)) return
    if (!props.chat.draft.value?.trim()) return
    recalled.value = null
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
      <details
        v-if="message.thinking"
        data-thinking
        :open="thinking_open"
        @toggle="thinking_open = $event.target.open">
        <summary>Thinking</summary>
        <p>{{ message.thinking }}</p>
      </details>
      <section itemprop="text" v-html="message_html(message.text)" />
    </li>
  </ol>
  <section v-if="chat.taken?.value" data-taken aria-label="Chat in another tab">
    <p>Another tab is using this chat.</p>
    <button type="button" @click="chat.take_back()">Use here</button>
  </section>
  <form
    v-else
    data-chat
    :aria-busy="chat.working.value ? 'true' : null"
    @submit.prevent="send">
    <button
      v-if="far"
      type="button"
      data-latest
      aria-label="Jump to latest message"
      title="Jump to latest message · Ctrl+End"
      @mousedown.prevent
      @click="to_end()">
      ↓
    </button>
    <menu v-if="suggestions.length" aria-label="Commands">
      <li v-for="command in suggestions" :key="command.name">
        <button type="button" @mousedown.prevent @click="pick(command)">
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
      @focusout="on_leave"
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
      & ul,
      & ol {
        margin: 0 0 base-line;
        padding-inline-start: base-line * 1.5;
        list-style-position: outside;
      }
      & ul {
        list-style-type: disc;
      }
      & ol {
        list-style-type: decimal;
      }
      & li {
        margin-block-end: (base-line / 4);
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
      inline-size: base-line * 1.5;
      block-size: base-line * 1.5;
      padding: 0;
      border: round(base-line * 0.1, 2) solid var(--emphasis);
      border-radius: 50%;
      line-height: 1;
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
      &:focus-visible {
        outline: none;
      }
    }

  }
  details[data-thinking] {
    color: var(--muted-text);
    & > summary {
      cursor: pointer;
    }
    & > p {
      margin: 0;
      white-space: pre-wrap;
    }
  }
  section[data-taken] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: base-line;
    padding: base-line;
    & > p {
      margin: 0;
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

<script setup>
  import WorkingBorder from '@/components/working-border.vue'
  import { message_html } from '@/utils/message-markdown'
  import { create_parts } from '@/utils/chat-parts'
  import {
    nextTick as next_tick,
    onMounted as on_mounted,
    ref,
    watch
  } from 'vue'

  /* One conversation: its messages and the input with Pi's working light.
     Renders two siblings so a page's grid can place each; the page shows
     chat.status in the box below. */
  const props = defineProps({
    chat: { type: Object, required: true }
  })

  const list = ref(null)
  const input = ref(null)

  const to_end = async () => {
    await next_tick()
    list.value?.lastElementChild?.scrollIntoView({ block: 'end' })
  }

  watch(() => props.chat.messages.value.length, to_end)
  // Every chunk re-renders the reply; drawn parts return before paint.
  const draw_parts = create_parts()
  watch(
    () => [
      props.chat.messages.value.length,
      props.chat.messages.value.at(-1)?.text
    ],
    () => list.value && draw_parts(list.value),
    { flush: 'post' }
  )
  on_mounted(() => draw_parts(list.value))

  const on_key = event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    props.chat.send()
  }

  defineExpose({ focus: () => input.value?.focus(), to_end, input })
</script>

<template>
  <ol ref="list" data-chat aria-label="Conversation" aria-live="polite">
    <li
      v-for="(message, index) in chat.messages.value"
      :key="index"
      itemscope
      itemtype="https://schema.org/Message">
      <strong itemprop="sender">{{ message.sender }}</strong>
      <section itemprop="text" v-html="message_html(message.text)" />
    </li>
  </ol>
  <form
    data-chat
    :aria-busy="chat.working.value ? 'true' : null"
    @submit.prevent="chat.send">
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
    // Newest at the bottom. An end-aligned grid pushes overflow above the
    // top, where it cannot scroll; an auto margin on the first message
    // pins a short chat to the bottom and lets a long one scroll back.
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
    // Wide code scrolls in its own block, not the whole conversation.
    & pre {
      max-inline-size: 100%;
      overflow-x: auto;
      overflow-wrap: normal;
    }
    & > li > strong[itemprop='sender'] {
      display: block;
      font-weight: 300;
      color: var(--accent);
    }
    // A link card part: name, then host, then the page's own description.
    & a[itemprop='url'] > figure {
      margin: 0 0 base-line;
      padding: (base-line / 2) base-line;
      border: 1px solid var(--muted-text);
      border-radius: (base-line / 2);
      & > figcaption {
        display: grid;
      }
      & span[itemprop='provider'] {
        color: var(--muted-text);
      }
    }
    // A part still streaming or drawing holds its place without its source.
    & pre.mermaid[aria-busy='true'],
    & pre.cardlink[aria-busy='true'] {
      color: transparent;
      user-select: none;
      min-block-size: base-line * 4;
      border: 1px dashed var(--muted-text);
      border-radius: (base-line / 2);
    }
    & pre.mermaid[data-processed] {
      background: none;
      // The app sizes every svg like an icon; a diagram keeps the size
      // mermaid laid out, and a wide one scrolls in its own box.
      & > svg {
        inline-size: auto;
        block-size: auto;
        max-inline-size: none;
      }
    }
    // The blog's tracks: prose holds a legible measure on text; parts and
    // code break out to wide, the whole message.
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
    // A table keeps whole words in its cells and scrolls when wider than
    // the message, instead of crushing each cell to its narrowest letter.
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
        border-block-end: 1px solid var(--muted-text);
        text-align: start;
        vertical-align: top;
      }
    }
  }
  form[data-chat] {
    max-width: none;
    padding: base-line;
    position: relative;
    // The app's working-border, held to the input instead of the window.
    & > div.working-border {
      position: absolute;
      inset: base-line auto base-line base-line;
      inline-size: 'calc(100% - %s)' % (base-line * 2);
      max-inline-size: page-width;
      border-radius: base-line;
      padding: 2px;
      // A wide, short ring: a rotating wedge only grazes the long edges, so
      // the light travels the edge itself at an even pace instead.
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
    & > textarea {
      box-sizing: border-box;
      inline-size: 100%;
      max-width: page-width;
      line-height: base-line;
      padding: (base-line / 2) base-line;
      border: 1px solid var(--emphasis);
      border-radius: base-line;
      color: var(--text);
      caret-color: var(--text);
      resize: none;
      // Grows with each line typed, up to a third of the screen, then scrolls.
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

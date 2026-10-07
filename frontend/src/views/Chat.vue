<script setup>
  import { current_user } from '@/utils/serverless'
  import { choose_actor, open_terminal } from '@/utils/brayness-gate'
  import {
    chat_warning,
    readable_error,
    send_chat,
    watch_chat
  } from '@/utils/brayness-chat'
  import { message_html } from '@/utils/message-markdown'
  import WorkingBorder from '@/components/working-border.vue'
  import SiteNav from '@/components/site-nav'
  import {
    nextTick as next_tick,
    onBeforeUnmount as on_before_unmount,
    onMounted as on_mounted,
    ref
  } from 'vue'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import wasm_url from '../../terminal/public/ghostty-vt.wasm?url'

  /* The actor's one Pi session: the GUI, and past the display gate the TUI
     beside it, both through the gate. The watch draws both sides of every
     turn; sending only hands Pi the message. */
  defineOptions({ name: 'Chat' })

  const RECONNECT_MS = 2000
  const DAY = 10
  // display-begins in base-line.styl; the style below gates on the same width.
  const DISPLAY_BEGINS = '(min-width: 80rem)'

  const route = use_route()
  const router = use_router()
  const actor = ref(route.query.actor ?? null)
  const messages = ref([])
  const draft = ref('')
  const status = ref('')
  const working = ref(false)
  const view = ref('both')
  const tui_shown = ref(false)
  const conversation = ref(null)
  const input = ref(null)
  const pane = ref(null)
  let watching = null
  let terminal = null
  let wide = null
  let left = false

  const to_end = async () => {
    await next_tick()
    conversation.value?.lastElementChild?.scrollIntoView({ block: 'end' })
  }

  /** Near a model-use limit, say so once per step per day. */
  const check_limit = async () => {
    const warn = await chat_warning(current_user.value, actor.value)
    if (!warn) return
    const day = new Date().toISOString().slice(0, DAY)
    const key = `brayness-warned ${day} ${warn.limit} ${warn.at ?? ''}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    status.value = warn.message
  }

  /** One watch record onto the page; returns the reply still streaming. */
  const apply = (record, streaming) => {
    let reply = streaming
    if (record.type === 'history')
      messages.value = record.messages.map(message => ({
        sender: message.role === 'user' ? 'You' : 'Brayness',
        text: message.text
      }))
    if (record.type === 'working') working.value = record.on
    if (record.type === 'user')
      messages.value.push({ sender: 'You', text: record.text })
    if (record.type === 'delta') {
      if (!reply) {
        messages.value.push({ sender: 'Brayness', text: '' })
        reply = messages.value.at(-1)
      }
      reply.text += record.text
    }
    if (record.type === 'assistant_end') {
      if (!record.text.trim()) {
        if (reply) messages.value.splice(messages.value.indexOf(reply), 1)
      } else if (reply) reply.text = record.text
      else messages.value.push({ sender: 'Brayness', text: record.text })
      if (record.error) status.value = readable_error(record.error)
      else check_limit()
      return null
    }
    if (record.type === 'assistant') return null
    if (record.type === 'error') throw new Error(record.text)
    return reply
  }

  const watch = async () => {
    watching = new AbortController()
    let reply = null
    try {
      const records = await watch_chat(current_user.value, actor.value, {
        signal: watching.signal
      })
      for await (const record of records) {
        reply = apply(record, reply)
        to_end()
      }
    } catch (thrown) {
      if (left) return
      status.value = readable_error(thrown.message)
    }
    working.value = false
    if (!left) setTimeout(watch, RECONNECT_MS)
  }

  const on_send = async () => {
    const message = draft.value.trim()
    if (!message || !actor.value) return
    draft.value = ''
    status.value = ''
    try {
      await send_chat(current_user.value, actor.value, message)
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      if (!draft.value) draft.value = message
    }
  }

  const on_key = event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    on_send()
  }

  /** The TUI connects only when the display can show it, so a phone never
      takes the terminal from another tab. */
  const mount_tui = async () => {
    if (!wide?.matches || tui_shown.value || !actor.value) return
    tui_shown.value = true
    await next_tick()
    try {
      const { mount } = await import('../../terminal/src/terminal.js')
      if (left) return
      const user = current_user.value
      terminal = await mount(pane.value, {
        actor: actor.value,
        exec: 'brayness',
        wasm_url: new URL(wasm_url, location.href),
        focus: false,
        open: size => open_terminal(user, actor.value, size)
      })
      if (left) terminal.close()
    } catch (thrown) {
      status.value = `TUI: ${thrown.message}`
    }
  }

  const on_view = async next => {
    view.value = next
    await next_tick()
    // The TUI sizes itself to the window; tell it the pane changed.
    window.dispatchEvent(new Event('resize'))
    if (next === 'tui') pane.value?.querySelector('canvas')?.focus()
    else input.value?.focus()
  }

  /** Alt+1 GUI, Alt+2 both, Alt+3 TUI, from either side. Read by physical
      key (event.code) so macOS Option characters never land in the input;
      Pi binds no Alt+digit, and the browser keeps Cmd/Ctrl+digit. */
  const SHORTCUTS = { Digit1: 'gui', Digit2: 'both', Digit3: 'tui' }
  const VIEW_NAMES = { gui: 'GUI', both: 'Both', tui: 'TUI' }
  const ORDER = ['both', 'gui', 'tui']
  const next_view = () => ORDER[(ORDER.indexOf(view.value) + 1) % ORDER.length]
  /** Cmd+K clears the GUI's conversation, as it clears the TUI's scrollback
      when the TUI has focus. Only the view: Pi keeps the session, and a
      reconnect draws its history again. */
  const on_clear = event => {
    if (!event.metaKey || event.key.toLowerCase() !== 'k') return
    if (pane.value?.contains(document.activeElement)) return
    event.preventDefault()
    messages.value = []
  }

  const on_cycle = event => {
    on_clear(event)
    const next = SHORTCUTS[event.code]
    if (!next || !event.altKey || event.ctrlKey || event.metaKey) return
    if (!wide?.matches || !tui_shown.value) return
    event.preventDefault()
    event.stopImmediatePropagation()
    on_view(next)
  }

  on_mounted(async () => {
    window.addEventListener('keydown', on_cycle, { capture: true })
    input.value?.focus()
    try {
      if (!actor.value) {
        actor.value = (await choose_actor(current_user.value)).id
        router.replace({ query: { ...route.query, actor: actor.value } })
      }
      if (left) return
      wide = window.matchMedia(DISPLAY_BEGINS)
      wide.addEventListener('change', mount_tui)
      mount_tui()
      watch()
    } catch (thrown) {
      status.value = readable_error(thrown.message)
    }
  })

  on_before_unmount(() => {
    left = true
    window.removeEventListener('keydown', on_cycle, { capture: true })
    wide?.removeEventListener('change', mount_tui)
    watching?.abort()
    terminal?.close()
  })
</script>

<template>
  <section id="chat" :data-view="view">
    <header>
      <site-nav />
      <button
        type="button"
        :value="view"
        :aria-label="`View: ${VIEW_NAMES[view]}. Next: ${VIEW_NAMES[next_view()]}`"
        aria-keyshortcuts="Alt+1 Alt+2 Alt+3"
        :title="`${VIEW_NAMES[view]} (Option+1, 2, 3)`"
        @click="on_view(next_view())">
        <svg viewBox="0 0 16 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="15" height="11" rx="2" />
          <line v-if="view === 'both'" x1="6" y1="0.5" x2="6" y2="11.5" />
          <line v-if="view === 'gui'" x1="5" y1="9" x2="11" y2="9" />
          <polyline v-if="view === 'tui'" points="3.5,4 5.5,6 3.5,8" />
        </svg>
      </button>
    </header>
    <ol ref="conversation" aria-label="Conversation" aria-live="polite">
      <li
        v-for="(message, index) in messages"
        :key="index"
        itemscope
        itemtype="https://schema.org/Message">
        <strong itemprop="sender">{{ message.sender }}</strong>
        <section itemprop="text" v-html="message_html(message.text)" />
      </li>
    </ol>
    <form :aria-busy="working ? 'true' : null" @submit.prevent="on_send">
      <working-border :active="working" />
      <textarea
        ref="input"
        v-model="draft"
        name="message"
        rows="1"
        aria-label="Message"
        required
        @keydown="on_key" />
    </form>
    <p role="status">{{ status }}</p>
    <aside aria-hidden="true" />
    <section v-if="tui_shown" ref="pane" aria-label="TUI">
      <canvas tabindex="0" />
      <output />
    </section>
  </section>
</template>

<style lang="stylus">
  section#chat {
    width: 100%;
    block-size: 100dvh;
    display: grid;
    // The site nav spans the window, as on About; the GUI is centered below.
    grid-template-columns: minmax(0, 1fr) minmax(0, page-width) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1440px) auto auto 1fr;
    grid-template-areas: 'header header header' '. conversation .' '. input .' '. status .' '. box .';
    column-gap: base-line;
    overflow: hidden;
    & > header {
      grid-area: header;
      display: flex;
      align-items: center;
      // The site nav as on About; the view icon closes its row.
      & > nav {
        flex: 1;
      }
      & > button {
        display: none;
        padding: 0;
        margin-inline-end: base-line;
        border: 0;
        background: none;
        color: var(--accent);
        opacity: 0.6;
        cursor: pointer;
        focus-ring();
        &:hover {
          opacity: 1;
        }
        & > svg {
          display: block;
          inline-size: base-line;
          fill: none;
          stroke: currentColor;
          stroke-width: 1;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      }
    }
    & > ol {
      grid-area: conversation;
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
      & > li > section[itemprop='text'] > :last-child {
        margin-bottom: 0;
      }
    }
    & > form {
      grid-area: input;
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
    & > p[role='status'] {
      grid-area: status;
      margin: 0;
      padding: 0 base-line base-line;
      &:empty {
        display: none;
      }
    }
    & > aside {
      display: block;
      grid-area: box;
      min-height: 0;
      margin: 0 base-line base-line;
      border-radius: base-line;
      background: var(--code-surface);
    }
    & > section[aria-label='TUI'] {
      display: none;
      grid-area: tui;
      position: relative;
      min-height: 0;
      overflow: hidden;
      padding-inline: (base-line / 2);
      user-select: none;
      & > canvas {
        display: block;
        outline: none;
        cursor: text;
      }
      & > output {
        position: absolute;
        inset-block-end: 0;
        inset-inline-end: (base-line / 2);
        color: var(--muted-text);
        font-family: ui-monospace, Menlo, monospace;
        pointer-events: none;
      }
    }
    @media (min-width: display-begins) {
      &:has(> section[aria-label='TUI']) {
        // The GUI stays the width of its input; the TUI takes the rest.
        grid-template-columns: minmax(0, page-width) minmax(0, 1fr);
        grid-template-areas: 'header header' 'conversation tui' 'input tui' 'status tui' 'box tui';
        justify-content: stretch;
        & > header > button {
          display: block;
        }
        & > section[aria-label='TUI'] {
          display: block;
          border-left: 1px solid var(--code-surface);
        }
      }
      &:has(> section[aria-label='TUI'])[data-view='gui'] {
        grid-template-columns: minmax(0, 1fr) minmax(0, page-width) minmax(0, 1fr);
        grid-template-areas: 'header header header' '. conversation .' '. input .' '. status .' '. box .';
        & > section[aria-label='TUI'] {
          display: none;
        }
      }
      &:has(> section[aria-label='TUI'])[data-view='tui'] {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'header' 'tui' 'tui' 'tui' 'tui';
        & > ol,
        & > form,
        & > p[role='status'],
        & > aside {
          display: none;
        }
      }
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

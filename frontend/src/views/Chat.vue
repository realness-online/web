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
  import {
    inject,
    watch as vue_watch,
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
  // Pi working lights the same edge sweep as Realness syncing (App.vue).
  const set_working = inject('set_working', () => {})
  vue_watch(working, on => set_working(on), { flush: 'sync' })
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

  const fit_input = () => {
    const box = input.value
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight}px`
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
    await next_tick()
    fit_input()
    try {
      await send_chat(current_user.value, actor.value, message)
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      if (!draft.value) draft.value = message
      await next_tick()
      fit_input()
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
  const on_cycle = event => {
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
    if (working.value) set_working(false)
    window.removeEventListener('keydown', on_cycle, { capture: true })
    wide?.removeEventListener('change', mount_tui)
    watching?.abort()
    terminal?.close()
  })
</script>

<template>
  <section id="chat">
    <header>
      <h1><router-link to="/" aria-label="Home">Brayness</router-link></h1>
      <nav aria-label="View">
        <button
          type="button"
          value="gui"
          aria-keyshortcuts="Alt+1"
          title="Alt+1"
          :aria-pressed="String(view === 'gui')"
          @click="on_view('gui')">
          GUI
        </button>
        <button
          type="button"
          value="both"
          aria-keyshortcuts="Alt+2"
          title="Alt+2"
          :aria-pressed="String(view === 'both')"
          @click="on_view('both')">
          Both
        </button>
        <button
          type="button"
          value="tui"
          aria-keyshortcuts="Alt+3"
          title="Alt+3"
          :aria-pressed="String(view === 'tui')"
          @click="on_view('tui')">
          TUI
        </button>
      </nav>
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
      <textarea
        ref="input"
        v-model="draft"
        name="message"
        rows="1"
        aria-label="Message"
        required
        @input="fit_input"
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
    column = page-width + base-line * 2
    width: 100%;
    block-size: 100dvh;
    display: grid;
    grid-template-columns: minmax(0, column);
    grid-template-rows: auto minmax(0, page-width) auto auto 1fr;
    grid-template-areas: 'header' 'conversation' 'input' 'status' 'box';
    justify-content: center;
    column-gap: base-line;
    overflow: hidden;
    & > header {
      grid-area: header;
      padding: base-line;
      display: flex;
      align-items: center;
      justify-content: space-between;
      & > h1 {
        margin: 0;
        font-weight: 300;
        line-height: 1;
        color: var(--accent);
        & > a {
          color: inherit;
          text-decoration: none;
        }
      }
      & > nav {
        display: none;
        gap: (base-line / 2);
        & > button {
          standard-button: var(--accent);
          color: var(--accent);
          cursor: pointer;
          focus-ring();
          &[aria-pressed='true'] {
            background-color: var(--accent);
            color: var(--surface);
          }
        }
      }
    }
    & > ol {
      grid-area: conversation;
      margin: 0;
      padding: 0 base-line;
      overflow-y: auto;
      display: grid;
      align-content: end;
      gap: base-line;
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
        overflow: hidden;
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
        grid-template-areas: 'header header' 'conversation tui' 'input tui' 'status tui' 'box tui';
        justify-content: stretch;
        & > header > nav {
          display: flex;
        }
        & > section[aria-label='TUI'] {
          display: block;
          border-left: 1px solid var(--code-surface);
        }
      }
      &:has(> header button[value='gui'][aria-pressed='true']) {
        grid-template-columns: minmax(0, column);
        grid-template-areas: 'header' 'conversation' 'input' 'status' 'box';
        justify-content: center;
        & > section[aria-label='TUI'] {
          display: none;
        }
      }
      &:has(> header button[value='tui'][aria-pressed='true']) {
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

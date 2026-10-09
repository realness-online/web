<script setup>
  import { current_user } from '@/utils/serverless'
  import { choose_actor, open_terminal } from '@/utils/brayness-gate'
  import { readable_error } from '@/utils/brayness-chat'
  import { use_chat } from '@/use/chat'
  import AsConversation from '@/components/chat/as-conversation.vue'
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
     beside it, both through the gate. */
  defineOptions({ name: 'Chat' })

  // display-begins in base-line.styl; the style below gates on the same width.
  const DISPLAY_BEGINS = '(min-width: 80rem)'

  const route = use_route()
  const router = use_router()
  const actor = ref(route.query.actor ?? null)
  const talk = ref(null)
  const chat = use_chat(actor, { on_change: () => talk.value?.to_end() })
  const { status } = chat
  const view = ref('both')
  const tui_shown = ref(false)
  const pane = ref(null)
  let terminal = null
  let wide = null
  let left = false

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
    else talk.value?.focus()
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
    chat.clear()
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
    talk.value?.focus()
    try {
      if (!actor.value) {
        actor.value = (await choose_actor(current_user.value)).id
        router.replace({ query: { ...route.query, actor: actor.value } })
      }
      if (left) return
      wide = window.matchMedia(DISPLAY_BEGINS)
      wide.addEventListener('change', mount_tui)
      mount_tui()
      chat.watch()
    } catch (thrown) {
      status.value = readable_error(thrown.message)
    }
  })

  on_before_unmount(() => {
    left = true
    window.removeEventListener('keydown', on_cycle, { capture: true })
    wide?.removeEventListener('change', mount_tui)
    chat.stop()
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
    <as-conversation ref="talk" :chat="chat" />
    <aside aria-label="Status">
      <p role="status">{{ chat.status.value }}</p>
    </aside>
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
    grid-template-rows: auto minmax(0, 1440px) auto 1fr;
    grid-template-areas: 'header header header' '. conversation .' '. input .' '. box .';
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
    }
    & > form {
      grid-area: input;
    }
    & > aside {
      display: block;
      grid-area: box;
      min-height: 0;
      margin: 0 base-line base-line;
      border-radius: base-line;
      background: var(--code-surface);
      overflow: auto;
      & > p {
        margin: 0;
        padding: base-line;
      }
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
        grid-template-areas: 'header header' 'conversation tui' 'input tui' 'box tui';
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
        grid-template-areas: 'header header header' '. conversation .' '. input .' '. box .';
        & > section[aria-label='TUI'] {
          display: none;
        }
      }
      &:has(> section[aria-label='TUI'])[data-view='tui'] {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'header' 'tui' 'tui' 'tui';
        & > ol,
        & > form,
        & > aside {
          display: none;
        }
      }
    }
  }
</style>

<script setup>
  import AsConnectionFeedback from '@/components/chat/as-connection-feedback.vue'
  import { current_user } from '@/utils/serverless'
  import { open_terminal, load_layout, save_layout } from '@/utils/gate'
  import { use_home_view } from '@/use/home-view'
  import { use_actor_startup } from '@/use/actor-startup'
  import { create_startup_trace } from '../../../harness/startup.js'
  import {
    computed,
    inject,
    nextTick as next_tick,
    onBeforeUnmount as on_before_unmount,
    ref,
    watch
  } from 'vue'
  import wasm_url from '@/terminal/ghostty-vt.wasm?url'

  const props = defineProps({
    actor: { type: String, default: null },
    finding: { type: Boolean, default: false },
    problem: { type: String, default: '' },
    progress: { type: Object, default: null }
  })
  const emit = defineEmits(['retry'])
  const set_working = inject('set_working', () => {})

  const { view, shows, wide } = use_home_view()
  /** Split panes: each is its own shell session on the actor. null is the first. */
  const MAX_PANES = 4
  const panes = ref([{ session: null }])
  const direction = ref('row')
  const stages = new Map()
  const terminals = new Map()
  const stage_ref = session => element => {
    if (element) stages.set(session, element)
    else stages.delete(session)
  }
  const focused = ref(null)
  const first_stage = () =>
    stages.get(focused.value) ?? stages.get(panes.value[0]?.session ?? null)
  const focus_pane = session => {
    stages.get(session)?.querySelector('canvas')?.focus()
  }
  /** Ctrl+Alt+Left/Right moves between panes; plain keys stay with the app. */
  const hop_pane = event => {
    if (!event.ctrlKey || !event.altKey) return
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[
      event.key
    ]
    if (!step || panes.value.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    const at = panes.value.findIndex(pane => pane.session === focused.value)
    const next = panes.value.at((Math.max(at, 0) + step) % panes.value.length)
    focus_pane(next.session)
  }
  const mounted = ref(false)
  const mount_problem = ref('')
  const loading = ref(false)
  const startup = use_actor_startup(current_user)
  const connection_progress = ref(
    /** @type {import('../../../harness/startup.js').StartupEvent | null} */ (
      null
    )
  )
  const feedback_progress = computed(() => {
    if (props.finding || props.problem) return props.progress
    if (startup.finding.value) return startup.progress.value
    return connection_progress.value
  })
  let left = false
  let opening_socket = false
  let attempt_id = 0
  /** The newest connect attempt per pane; clearing it cancels them all. */
  const latest = new Map()

  const set_loading = active => {
    if (loading.value === active) return
    loading.value = active
    set_working(active)
  }

  const connect_terminal = async (user, actor, size, session = null) => {
    if (left) throw new DOMException('Terminal cancelled', 'AbortError')
    const attempt = ++attempt_id
    latest.set(session, attempt)
    opening_socket = true
    connection_progress.value = null
    mount_problem.value = ''
    set_loading(true)
    /** @type {((state?: import('../../../harness/startup.js').StartupResult) => void) | null} */
    let finish = null
    try {
      const ready = await startup.prepare(actor)
      if (left || attempt !== latest.get(session))
        throw new DOMException('Terminal cancelled', 'AbortError')
      const trace = create_startup_trace({
        id: ready.startup_id,
        report: event => {
          if (!left && attempt === latest.get(session))
            connection_progress.value = { ...event, source: 'terminal' }
        }
      })
      finish = trace.begin('connecting_terminal')
      const socket = await open_terminal(user, actor, { ...size, session })
      if (left || attempt !== latest.get(session)) {
        socket.close()
        throw new DOMException('Terminal cancelled', 'AbortError')
      }
      let opened = false
      socket.addEventListener('open', () => {
        if (left || attempt !== latest.get(session)) return
        opened = true
        finish?.()
        opening_socket = false
        set_loading(false)
      })
      socket.addEventListener('close', () => {
        if (left || attempt !== latest.get(session)) return
        finish?.('failed')
        if (!opened) mount_problem.value = 'Terminal connection closed'
        opening_socket = false
        set_loading(false)
      })
      socket.addEventListener('error', () => {
        if (left || attempt !== latest.get(session)) return
        finish?.('failed')
        mount_problem.value = 'Terminal connection failed'
        opening_socket = false
        set_loading(false)
      })
      return socket
    } catch (error) {
      finish?.('failed')
      if (!left && attempt === latest.get(session)) {
        connection_progress.value ??= startup.progress.value
        mount_problem.value = error.message
        opening_socket = false
        set_loading(false)
      }
      throw error
    }
  }

  const mount_pane = async (mount, user, actor, { session }) => {
    if (terminals.has(session)) return
    const stage = stages.get(session)
    if (!stage) return
    terminals.set(session, null)
    const terminal = await mount(stage, {
      actor,
      wasm_url: new URL(wasm_url, location.href),
      focus: view.value === 'tui' && session === panes.value.at(-1)?.session,
      open: size => connect_terminal(user, actor, size, session)
    })
    if (left || !panes.value.some(pane => pane.session === session))
      return terminal.close()
    terminals.set(session, terminal)
  }

  const close_terminals = () => {
    for (const terminal of terminals.values()) terminal?.close()
    terminals.clear()
  }

  /**
   * The panes the person left open on this actor. No saved layout yet, or an
   * older halo, keeps what is shown: one pane on first open.
   */
  const restore_layout = async (user, actor) => {
    try {
      const layout = await load_layout(user, actor)
      const saved = Array.isArray(layout?.panes) ? layout.panes : []
      if (
        saved.length &&
        saved.length <= MAX_PANES &&
        saved[0].session === null
      )
        panes.value = saved.map(({ session }) => ({ session: session ?? null }))
      if (layout?.direction === 'column') direction.value = 'column'
    } catch {}
  }

  const keep_layout = () => {
    const user = current_user.value
    if (!user || !props.actor) return
    save_layout(user, props.actor, {
      panes: panes.value,
      direction: direction.value
    }).catch(() => {})
  }

  const mount_terminal = async () => {
    if (mounted.value || !props.actor || !wide.value) return
    mounted.value = true
    mount_problem.value = ''
    set_loading(true)
    try {
      const user = current_user.value
      const { actor } = props
      await restore_layout(user, actor)
      await next_tick()
      const { mount } = await import('@/terminal/terminal.js')
      if (left) return
      // eslint-disable-next-line no-await-in-loop -- panes mount in layout order, one terminal socket at a time
      for (const pane of panes.value) await mount_pane(mount, user, actor, pane)
    } catch (thrown) {
      mount_problem.value = `TUI: ${thrown.message}`
    } finally {
      if (!opening_socket) set_loading(false)
    }
  }

  const split = async () => {
    if (panes.value.length >= MAX_PANES) return
    const used = new Set(panes.value.map(pane => pane.session))
    let n = 1
    while (used.has(`p${n}`)) n++
    const pane = { session: `p${n}` }
    panes.value = [...panes.value, pane]
    keep_layout()
    await next_tick()
    const { mount } = await import('@/terminal/terminal.js')
    await mount_pane(mount, current_user.value, props.actor, pane)
    focus_pane(pane.session)
  }

  /** Closing a pane detaches it; its shell keeps running on the actor. */
  const close_pane = session => {
    if (session === null) return
    terminals.get(session)?.close()
    terminals.delete(session)
    panes.value = panes.value.filter(pane => pane.session !== session)
    keep_layout()
    if (focused.value === session) {
      focused.value = null
      next_tick(() => focus_pane(panes.value.at(-1)?.session ?? null))
    }
  }

  const turn = () => {
    direction.value = direction.value === 'row' ? 'column' : 'row'
    keep_layout()
  }

  const retry = () => {
    if (props.problem) return emit('retry')
    latest.clear()
    close_terminals()
    opening_socket = false
    mounted.value = false
    return mount_terminal()
  }

  /** Each pane watches its own size; a window event covers older browsers. */
  const settle = () => window.dispatchEvent(new Event('resize'))

  watch(
    () => [shows.value.tui, props.actor],
    async ([open], before) => {
      if (before && before[1] !== props.actor) {
        latest.clear()
        close_terminals()
        panes.value = [{ session: null }]
        focused.value = null
        mounted.value = false
      }
      if (!open) return
      await mount_terminal()
      await next_tick()
      settle()
      if (view.value === 'tui') first_stage()?.querySelector('canvas')?.focus()
    },
    { immediate: true }
  )

  on_before_unmount(() => {
    left = true
    latest.clear()
    startup.stop()
    set_loading(false)
    close_terminals()
  })
</script>

<template>
  <section
    id="tui-pane"
    aria-label="TUI"
    :data-open="shows.tui || undefined"
    :data-alone="view === 'tui' || undefined"
    :inert="!shows.tui || undefined"
    :aria-busy="finding || loading || undefined"
    @transitionend.self="settle">
    <header>
      <slot />
    </header>
    <as-connection-feedback
      v-if="problem || mount_problem || finding || loading"
      :problem="problem || mount_problem"
      :progress="feedback_progress"
      @retry="retry" />
    <section
      v-if="mounted"
      data-panes
      :data-direction="direction"
      @keydown.capture="hop_pane">
      <menu v-if="wide">
        <li>
          <button
            type="button"
            :disabled="panes.length >= MAX_PANES || undefined"
            @click="split">
            Split
          </button>
        </li>
        <li v-if="panes.length > 1">
          <button type="button" @click="turn">
            {{ direction === 'row' ? 'Stack' : 'Side by side' }}
          </button>
        </li>
      </menu>
      <section
        v-for="item in panes"
        :key="item.session ?? 'main'"
        :ref="stage_ref(item.session)"
        data-terminal
        :data-focused="focused === item.session || undefined"
        @focusin="focused = item.session"
        :aria-label="item.session ? `Terminal ${item.session}` : 'Terminal'">
        <canvas tabindex="0" />
        <output />
        <button
          v-if="item.session"
          type="button"
          aria-label="Close pane"
          @click="close_pane(item.session)">
          ×
        </button>
      </section>
    </section>
  </section>
</template>

<style lang="stylus">
  section#tui-pane {
    chat-width = page-width
    position: fixed;
    inset-block: 0;
    inset-inline-start: chat-width;
    inset-inline-end: 0;
    z-index: 11;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    padding-top: env(safe-area-inset-top, 0px);
    background: var(--surface);
    translate: 100% 0;
    visibility: hidden;
    transition-property: translate, visibility, inset-inline-start;
    transition-duration: var(--duration-subject, 0.3s);
    transition-timing-function: var(--ease-reveal, ease-out);
    &[data-open] {
      translate: 0 0;
      visibility: visible;
    }
    &[data-alone] {
      inset-inline-start: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
    & > header {
      padding: base-line;
      &:has(> nav[itemtype$='/SiteNavigationElement']) {
        padding: 0;
      }
    }
    & > section[aria-label='Connection status'] {
      grid-area: 2 / 1;
      z-index: 1;
    }
    & > section[data-panes] {
      grid-area: 2 / 1;
      position: relative;
      display: flex;
      gap: 1px;
      min-block-size: 0;
      background: var(--muted-text);
      &[data-direction='column'] {
        flex-direction: column;
      }
      & > menu {
        position: absolute;
        inset-block-start: 0;
        inset-inline-end: (base-line / 2);
        z-index: 1;
        display: flex;
        gap: (base-line / 2);
        margin: 0;
        padding: 0;
        list-style: none;
        opacity: 0.4;
        &:hover, &:focus-within {
          opacity: 1;
        }
      }
    }
    & > section[data-panes]:has(> section[data-terminal] + section[data-terminal]) > section[data-focused] {
      box-shadow: inset 0 2px 0 var(--accent, currentColor);
    }
    & section[data-terminal] {
      flex: 1 1 0;
      min-inline-size: 0;
      background: var(--surface);
      position: relative;
      min-block-size: 0;
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
      & > button {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        opacity: 0.4;
        &:hover, &:focus {
          opacity: 1;
        }
      }
    }
  }
</style>

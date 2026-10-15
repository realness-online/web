<script setup>
  import AsConnectionFeedback from '@/components/chat/as-connection-feedback.vue'
  import { current_user } from '@/utils/serverless'
  import { open_terminal } from '@/utils/gate'
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
  const pane = ref(null)
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
  let terminal = null
  let left = false
  let opening_socket = false
  let attempt_id = 0

  const set_loading = active => {
    if (loading.value === active) return
    loading.value = active
    set_working(active)
  }

  const connect_terminal = async (user, actor, size) => {
    if (left) throw new DOMException('Terminal cancelled', 'AbortError')
    const attempt = ++attempt_id
    opening_socket = true
    connection_progress.value = null
    mount_problem.value = ''
    set_loading(true)
    /** @type {((state?: import('../../../harness/startup.js').StartupResult) => void) | null} */
    let finish = null
    try {
      const ready = await startup.prepare(actor)
      if (left || attempt !== attempt_id)
        throw new DOMException('Terminal cancelled', 'AbortError')
      const trace = create_startup_trace({
        id: ready.startup_id,
        report: event => {
          if (!left && attempt === attempt_id)
            connection_progress.value = { ...event, source: 'terminal' }
        }
      })
      finish = trace.begin('connecting_terminal')
      const socket = await open_terminal(user, actor, size)
      if (left || attempt !== attempt_id) {
        socket.close()
        throw new DOMException('Terminal cancelled', 'AbortError')
      }
      let opened = false
      socket.addEventListener('open', () => {
        if (left || attempt !== attempt_id) return
        opened = true
        finish?.()
        opening_socket = false
        set_loading(false)
      })
      socket.addEventListener('close', () => {
        if (left || attempt !== attempt_id) return
        finish?.('failed')
        if (!opened) mount_problem.value = 'Terminal connection closed'
        opening_socket = false
        set_loading(false)
      })
      socket.addEventListener('error', () => {
        if (left || attempt !== attempt_id) return
        finish?.('failed')
        mount_problem.value = 'Terminal connection failed'
        opening_socket = false
        set_loading(false)
      })
      return socket
    } catch (error) {
      finish?.('failed')
      if (!left && attempt === attempt_id) {
        connection_progress.value ??= startup.progress.value
        mount_problem.value = error.message
        opening_socket = false
        set_loading(false)
      }
      throw error
    }
  }

  const mount_terminal = async () => {
    if (mounted.value || !props.actor || !wide.value) return
    mounted.value = true
    mount_problem.value = ''
    set_loading(true)
    try {
      await next_tick()
      const { mount } = await import('@/terminal/terminal.js')
      if (left) return
      const user = current_user.value
      const { actor } = props
      terminal = await mount(pane.value, {
        actor,
        wasm_url: new URL(wasm_url, location.href),
        focus: view.value === 'tui',
        open: size => connect_terminal(user, actor, size)
      })
      if (left) terminal.close()
    } catch (thrown) {
      mount_problem.value = `TUI: ${thrown.message}`
    } finally {
      if (!opening_socket) set_loading(false)
    }
  }

  const retry = () => {
    if (props.problem) return emit('retry')
    attempt_id++
    terminal?.close()
    opening_socket = false
    mounted.value = false
    return mount_terminal()
  }

  /** The terminal sizes itself on window resize; tell it the pane moved. */
  const settle = () => window.dispatchEvent(new Event('resize'))

  watch(
    () => [shows.value.tui, props.actor],
    async ([open]) => {
      if (!open) return
      await mount_terminal()
      await next_tick()
      settle()
      if (view.value === 'tui') pane.value?.querySelector('canvas')?.focus()
    },
    { immediate: true }
  )

  on_before_unmount(() => {
    left = true
    attempt_id++
    startup.stop()
    set_loading(false)
    terminal?.close()
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
    <section v-if="mounted" ref="pane" data-terminal>
      <canvas tabindex="0" />
      <output />
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
    & > section[data-terminal] {
      grid-area: 2 / 1;
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
    }
  }
</style>

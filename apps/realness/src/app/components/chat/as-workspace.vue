<script setup>
  import { current_user } from '@/utils/serverless'
  import { use_actor_startup } from '@/use/actor-startup'
  import { HOME_VIEWS, use_home_view } from '@/use/home-view'
  import AsPanel from '@/components/chat/as-panel.vue'
  /** sp2: the pane used last, else the first. */
  const PANE_CANVAS = '#tui-pane [data-focused] > canvas, #tui-pane canvas'
  import AsTui from '@/components/chat/as-tui.vue'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import AsTuiNav from '@/components/chat/as-tui-nav.vue'
  import SiteNav from '@/components/site-nav.vue'
  import {
    inject,
    onBeforeUnmount as on_before_unmount,
    onMounted as on_mounted,
    nextTick as next_tick,
    watch
  } from 'vue'
  import { useRoute as use_route } from 'vue-router'

  const { view, views, shows, set_view, toggle_chat } = use_home_view()
  const route = use_route()
  const requested_actor =
    typeof route?.query?.actor === 'string' ? route.query.actor : undefined
  const startup = use_actor_startup(current_user, {
    set_working: inject('set_working', () => {})
  })
  const { actor, problem, finding, progress, startup_id } = startup
  let previous_focus = null

  watch(
    () => shows.value.chat,
    async open => {
      if (open) {
        previous_focus = document.activeElement
        return
      }
      await next_tick()
      if (previous_focus?.isConnected && !previous_focus.closest('[inert]'))
        previous_focus.focus()
      else if (shows.value.tui) document.querySelector(PANE_CANVAS)?.focus()
      else document.querySelector('section[aria-label="Current page"]')?.focus()
    },
    { flush: 'sync' }
  )

  watch(
    () => route?.path,
    path => {
      if (path === '/terminal') set_view(shows.value.chat ? 'chat-tui' : 'tui')
      else if (path === '/')
        set_view(shows.value.chat ? 'chat-thoughts' : 'thoughts')
      else if (view.value === 'chat') set_view('chat-thoughts')
      else if (shows.value.tui)
        set_view(shows.value.chat ? 'chat-thoughts' : 'thoughts')
    },
    { immediate: true }
  )

  const find_actor = async () => {
    if (actor.value || finding.value || !current_user.value) return
    await startup.prepare(requested_actor).catch(() => {})
  }

  watch(
    () => [shows.value.chat || shows.value.tui, current_user.value?.uid],
    ([needed]) => {
      if (needed) find_actor()
    },
    { immediate: true }
  )

  const key_commands = inject('key-commands', null)
  const LAYOUT_COMMANDS = [
    'Thoughts',
    'Chat_Thoughts',
    'Chat',
    'Chat_Tui',
    'Tui'
  ].map((name, index) => [`view::Layout_${name}`, HOME_VIEWS[index]])
  const register = (command, handler) =>
    key_commands?.register_handler(command, { handler, context: 'global' })
  register('view::Toggle_Chat', () => toggle_chat())
  for (const [command, layout] of LAYOUT_COMMANDS)
    register(command, () => views.value.includes(layout) && set_view(layout))
  on_before_unmount(() => {
    startup.stop()
    key_commands?.unregister_handler('view::Toggle_Chat')
    for (const [command] of LAYOUT_COMMANDS)
      key_commands?.unregister_handler(command)
  })

  /** Plain Tab hops chat -> terminal; Option+Tab hops either way. Inside
      the terminal, Tab and Shift+Tab stay pi's. Read by physical key in
      capture so the TUI never sees the hop. */
  const on_key = event => {
    if (
      event.code !== 'Tab' ||
      event.ctrlKey ||
      event.metaKey ||
      !shows.value.chat ||
      !shows.value.tui
    )
      return
    const input = document.querySelector('#chat-panel textarea[name="message"]')
    const canvas = document.querySelector(PANE_CANVAS)
    const from_input = event.target === input
    const from_canvas = Boolean(event.target?.matches?.('#tui-pane canvas'))
    const hop = event.altKey
      ? from_input || from_canvas
      : !event.shiftKey && from_input
    if (!hop) return
    event.preventDefault()
    event.stopImmediatePropagation()
    ;(from_input ? canvas : input).focus()
  }

  on_mounted(() =>
    window.addEventListener('keydown', on_key, { capture: true })
  )
  on_before_unmount(() =>
    window.removeEventListener('keydown', on_key, { capture: true })
  )
</script>

<template>
  <as-panel :actor="actor" :startup_id="startup_id" @leave="toggle_chat">
    <as-chat-toggle inside />
  </as-panel>
  <as-tui
    :actor="actor"
    :finding="finding"
    :problem="problem"
    :progress="progress"
    @retry="find_actor">
    <as-tui-nav v-if="route?.path === '/terminal'" />
    <as-chat-toggle v-else />
  </as-tui>
</template>

<script setup>
  import { current_user } from '@/utils/serverless'
  import { choose_actor } from '@/utils/brayness-gate'
  import { readable_error } from '@/utils/brayness-chat'
  import { HOME_VIEWS, use_home_view } from '@/use/home-view'
  import AsPanel from '@/components/chat/as-panel.vue'
  import AsTui from '@/components/chat/as-tui.vue'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import AsSideToggle from '@/components/chat/as-side-toggle.vue'
  import {
    onBeforeUnmount as on_before_unmount,
    onMounted as on_mounted,
    ref,
    watch
  } from 'vue'
  import { useRoute as use_route } from 'vue-router'

  /* Chat and the TUI beside Thoughts on the homepage: one actor's Pi
     session, found the first time either shows. */
  const { views, shows, wide, set_view, toggle_chat } = use_home_view()
  const route = use_route()
  const actor = ref(route?.query?.actor ?? null)
  const problem = ref('')
  let finding = false

  const find_actor = async () => {
    if (actor.value || finding || !current_user.value) return
    finding = true
    problem.value = ''
    try {
      actor.value = (await choose_actor(current_user.value)).id
    } catch (thrown) {
      problem.value = readable_error(thrown.message)
    } finally {
      finding = false
    }
  }

  watch(
    () => shows.value.chat || shows.value.tui,
    needed => {
      if (needed) find_actor()
    },
    { immediate: true }
  )

  /** Option+C brings chat in or out; Option+1 to 5 pick a layout. Read by
      physical key, in capture, so neither the macOS Option character nor
      the TUI ever sees them; Pi binds no Alt+C or Alt+digit. */
  const on_key = event => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return
    let wanted = null
    if (event.code === 'KeyC') wanted = 'toggle'
    const digit = /^Digit([1-5])$/.exec(event.code)
    if (digit) wanted = HOME_VIEWS[Number(digit[1]) - 1]
    if (!wanted) return
    if (wanted !== 'toggle' && !views.value.includes(wanted)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (wanted === 'toggle') toggle_chat()
    else set_view(wanted)
  }

  on_mounted(() =>
    window.addEventListener('keydown', on_key, { capture: true })
  )
  on_before_unmount(() =>
    window.removeEventListener('keydown', on_key, { capture: true })
  )
</script>

<template>
  <as-panel :actor="actor" :problem="problem" @leave="toggle_chat">
    <as-side-toggle v-if="wide" />
    <as-chat-toggle v-else />
  </as-panel>
  <as-tui :actor="actor">
    <as-chat-toggle />
  </as-tui>
</template>

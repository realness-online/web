<script setup>
  import { computed, ref } from 'vue'
  import AsSignOn from '@/components/as-sign-on.vue'
  import { cli_request, hand_off } from '@/utils/hand-off'
  import { current_user } from '@/utils/firebase'

  /* Sign-on is a page, never a dialog. The URL is the state, so every way of
     arriving shows the form, and Google's reCAPTCHA challenge has nothing to
     hide behind. */
  defineOptions({ name: 'SignOn' })

  const props = defineProps({
    query: { type: Object, default: () => ({}) }
  })

  /* A program on this computer is waiting. Any program here could open this
     link, so the sign-in only leaves on a click. */
  const cli = computed(() => cli_request(props.query))
  /* The browser terminal is waiting: this page opens its handoff and posts the
     pass over. Different origin, so a cookie cannot travel; a pass can. */
  const handoff = computed(() => props.query.handoff === '1')
  const signed_on = computed(() => !!current_user.value)
  const sending = ref(false)
  const error = ref('')

  const terminal_url = import.meta.env.VITE_BRAYNESS_URL
  const sync_url = import.meta.env.VITE_BRAYNESS_SYNC_URL

  const on_send_to_terminal = () => {
    const user = current_user.value
    if (!cli.value || !user) return
    sending.value = true
    hand_off(cli.value, {
      refresh_token: user.refreshToken,
      api_key: String(import.meta.env.VITE_API_KEY || '')
    })
  }

  const on_open_terminal = async (page = 'terminal') => {
    const user = current_user.value
    if (!handoff.value || !user || !terminal_url || !sync_url) return
    const target = new URL(terminal_url)
    const handoff_url = `${target.origin}/handoff${page === 'chat' ? '?next=chat' : ''}`
    const opened = window.open(handoff_url, '_blank')
    if (!opened) {
      error.value = 'Allow the terminal window, then try again.'
      return
    }
    sending.value = true
    error.value = ''
    let pass
    const receive = event => {
      if (
        event.origin !== target.origin ||
        event.source !== opened ||
        event.data?.type !== 'brayness-ready'
      )
        return
      opened.postMessage({ type: 'brayness-pass', pass }, target.origin)
      window.removeEventListener('message', receive)
    }
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${sync_url}/v1/host-pass`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Could not open the terminal')
      pass = (await response.json()).pass
      window.addEventListener('message', receive)
      // The handoff window may have sent ready before the pass arrived.
      opened.location.href = handoff_url
    } catch (thrown) {
      error.value = thrown.message
      opened.close()
    } finally {
      sending.value = false
    }
  }
</script>

<template>
  <section id="signing-on" data-page>
    <h1>Sign in to Brayness</h1>
    <button
      v-if="handoff && signed_on"
      type="button"
      id="open-terminal"
      :disabled="sending || !terminal_url || !sync_url"
      @click="on_open_terminal()">
      Open the TUI
    </button>
    <button
      v-if="handoff && signed_on"
      type="button"
      id="open-chat"
      :disabled="sending || !terminal_url || !sync_url"
      @click="on_open_terminal('chat')">
      Open the GUI
    </button>
    <button
      v-if="cli && signed_on"
      type="button"
      id="send-to-terminal"
      :disabled="sending"
      @click="on_send_to_terminal">
      Sign in Brayness on this computer
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <as-sign-on v-if="!signed_on || (!cli && !handoff)" />
  </section>
</template>

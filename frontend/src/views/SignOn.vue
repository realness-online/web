<script setup>
  import AsSignOn from '@/components/profile/as-sign-on'
  import { after_sign_on } from '@/utils/after-sign-on'
  import { cli_request, hand_off } from '@/utils/cli-hand-off'
  import { current_user, me } from '@/utils/serverless'
  import { valid_name } from '@/utils/valid-name'
  import { computed, ref } from 'vue'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'

  /* Sign-on is a page, never a dialog. The URL is the state, so every way of
     arriving shows the form, and Google's reCAPTCHA challenge has nothing to
     hide behind. */
  defineOptions({ name: 'SignOn' })

  const route = use_route()
  const router = use_router()

  /* `brayness login` on this computer is waiting. Any program here could open
     this link, so the sign-in only leaves on a click. */
  const cli = computed(() => cli_request(route.query))
  const signed_on = computed(
    () => !!current_user.value && valid_name(me.value?.name)
  )
  const sending = ref(false)

  const on_signed_in = () => {
    if (!cli.value) router.replace(after_sign_on(route.query))
  }

  const on_send_to_terminal = () => {
    const user = current_user.value
    if (!cli.value || !user) return
    sending.value = true
    hand_off(cli.value, {
      refresh_token: user.refreshToken,
      api_key: String(import.meta.env.VITE_API_KEY || '')
    })
  }
</script>

<template>
  <section id="signing-on" data-page>
    <button
      v-if="cli && signed_on"
      type="button"
      id="send-to-terminal"
      :disabled="sending"
      @click="on_send_to_terminal">
      Sign in Brayness on this computer
    </button>
    <as-sign-on v-else @signed_in="on_signed_in" />
  </section>
</template>

<style>
  section#signing-on[data-page] {
    display: grid;
    place-items: center;
    min-height: calc(100svh - var(--base-line) * 10);
    padding-inline: var(--base-line);

    & > section#sign-on {
      width: min(calc(var(--base-line) * 22), 100%);
    }
  }
</style>

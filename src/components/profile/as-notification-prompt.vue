<script setup>
  import { use_push } from '@/use/push'
  import { use_me } from '@/use/people'
  import { use_instance_capabilities } from '@/use/instance-capabilities'
  import { current_user } from '@/utils/serverless'
  import { notifications, notifications_prompted } from '@/utils/preference'
  import { ref, computed, watch } from 'vue'

  defineOptions({
    name: 'AsNotificationPrompt'
  })

  const { is_valid_name } = use_me()
  const { probe, push: push_available } = use_instance_capabilities()
  const { status, busy, refresh, enable } = use_push()
  const dialog = ref(null)

  const signed_in = computed(() => !!current_user.value && is_valid_name.value)

  // Once per device, whichever path gets someone signed in first — new
  // sign-up, an existing account on a new device, or a fresh install that
  // re-runs auth (iOS home-screen installs get isolated storage). Android
  // installs that share browser storage arrive already `signed_in`, so the
  // `immediate` watch below catches those too.
  const maybe_prompt = async () => {
    if (notifications_prompted.value) return
    await probe()
    if (!push_available.value) return
    await refresh()
    if (status.value !== 'off') return
    notifications_prompted.value = true
    dialog.value?.showModal()
  }

  watch(
    signed_in,
    value => {
      if (value) maybe_prompt()
    },
    { immediate: true }
  )

  const on_allow = async () => {
    const ok = await enable()
    notifications.value = ok
    dialog.value?.close()
  }

  const on_skip = () => {
    notifications.value = false
    dialog.value?.close()
  }

  const on_click = event => {
    if (event.target === dialog.value) dialog.value.close()
  }
</script>

<template>
  <dialog id="notification-prompt" ref="dialog" @click="on_click">
    <section>
      <p id="notification-prompt-ask">
        Want a nudge when something new goes up?
      </p>
      <p id="notification-prompt-cadence">
        We send one broadcast a week, Thursdays, Pacific time. Change this
        anytime in Account.
      </p>
      <menu>
        <button
          type="button"
          id="notification-prompt-allow"
          :disabled="busy"
          @click="on_allow">
          Turn on notifications
        </button>
        <button
          type="button"
          id="notification-prompt-skip"
          :disabled="busy"
          @click="on_skip">
          Not now
        </button>
      </menu>
    </section>
  </dialog>
</template>

<style lang="stylus">
  dialog#notification-prompt {
    margin: auto;
    max-width: page-width;
    border: none;
    border-radius: base-line * 0.5;
    padding: base-line * 1.5;

    &::backdrop {
      background: var(--basalt-transparent);
    }

    & > section {
      & > p#notification-prompt-cadence {
        font-size: 0.75em;
        opacity: 0.7;
        line-height: 1.4;
      }
      & > menu {
        display: flex;
        justify-content: flex-end;
        gap: base-line;
        margin-top: base-line;
        & > button#notification-prompt-allow {
          color: var(--emphasis);
        }
      }
    }
  }
</style>

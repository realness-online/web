<script setup>
  import AsSignOn from '@/components/profile/as-sign-on'
  import { ref, computed, watch, nextTick as tick } from 'vue'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { current_user, me } from '@/utils/serverless'

  const form = ref(null)
  const router = use_router()

  /**
   * Profile route path when we have a stable id (signed in or local profile).
   * @type {import('vue').ComputedRef<import('@/types').Id | null>}
   */
  const my_profile_path = computed(() => {
    const from_me = me.value?.id
    if (from_me && from_me.length > 2)
      return /** @type {import('@/types').Id} */ (from_me)
    if (typeof localStorage !== 'undefined' && localStorage.me?.length > 2)
      return /** @type {import('@/types').Id} */ (localStorage.me)
    return null
  })

  /** Full sign-on dialog: anonymous and no local profile id (see main.js default `/+`). */
  const needs_sign_on_dialog = computed(
    () => !current_user.value && !my_profile_path.value
  )

  /** non-modal dialog so reCAPTCHA challenge (body iframe) stacks above the panel */
  const layer_open = ref(false)
  const name = computed(() => {
    if (me.value?.name) return me.value.name
    if (needs_sign_on_dialog.value) return 'sign on'
    if (current_user.value) return 'account'
    return 'profile'
  })
  const route = use_route()

  const open_sign_on_dialog = () => {
    if (!form.value) return
    layer_open.value = true
    form.value.show()
    form.value.focus()
  }

  const show_form = () => {
    if (!needs_sign_on_dialog.value && my_profile_path.value) {
      router.push({ path: my_profile_path.value })
      return
    }
    if (!needs_sign_on_dialog.value) return
    if (!form.value) return
    if (form.value.open) form.value.close()
    else open_sign_on_dialog()
  }
  const backdrop_click = () => {
    if (form.value?.open) form.value.close()
  }
  const dialog_click = event => {
    if (event.target === form.value) form.value.close()
  }

  const signed_in = async () => {
    await tick()
    let path = null
    if (me.value?.id && me.value.id.length > 2) path = me.value.id
    else if (typeof localStorage !== 'undefined' && localStorage.me?.length > 2)
      path = localStorage.me
    if (path) await router.push({ path })
    if (form.value?.open) form.value.close()
    layer_open.value = false
  }

  const on_close = () => {
    layer_open.value = false
  }

  watch(
    () => route.hash,
    new_hash => {
      if (new_hash !== '#account') return
      if (!needs_sign_on_dialog.value && my_profile_path.value) {
        router.replace({ path: my_profile_path.value })
        return
      }
      if (!form.value) return
      open_sign_on_dialog()
    }
  )

  defineExpose({ show: show_form })
</script>

<template>
  <router-link
    v-if="!needs_sign_on_dialog && my_profile_path"
    id="toggle-account"
    :to="my_profile_path"
    >{{ name }}</router-link
  >
  <a v-else id="toggle-account" @click="show_form">{{ name }}</a>
  <div
    v-if="layer_open"
    class="account-dialog-backdrop"
    aria-hidden="true"
    @click="backdrop_click" />
  <dialog
    v-if="needs_sign_on_dialog"
    id="account"
    class="modal"
    ref="form"
    @click="dialog_click"
    @close="on_close">
    <as-sign-on @signed_in="signed_in" />
  </dialog>
</template>

<style lang="stylus">
  .account-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 8;
    background-color: black-transparent;
  }
  a#toggle-account {
    & > span {
      margin-left: base-line * .5;
      line-height: 0;
      display: inline-block;
      vertical-align: middle;
    }
  }
</style>

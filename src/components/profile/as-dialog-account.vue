<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import AsSignOn from '@/components/profile/as-sign-on'
  import icon from '@/components/icon'
  import { ref, computed, watch } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import { current_user, sign_off, me } from '@/utils/serverless'

  const form = ref(null)

  const my_profile_path = computed(() => me.value?.id ?? null)

  const view_profile_click = () => {
    if (form.value?.open) form.value.close()
  }
  /** non-modal dialog so reCAPTCHA challenge (body iframe) stacks above the panel */
  const layer_open = ref(false)
  const name = computed(() => {
    if (me.value?.name) return me.value.name
    if (current_user.value) return 'account'
    return 'sign on'
  })
  const route = use_route()
  const show_sign_in = ref(false)
  const is_mobile_form_visible = ref(false)
  const just_signed_in = ref(false)

  const show_form = () => {
    if (!form.value) return
    if (form.value.open) form.value.close()
    else {
      show_sign_in.value = false
      is_mobile_form_visible.value = false
      layer_open.value = true
      form.value.show()
      form.value.focus()
    }
  }
  const backdrop_click = () => {
    if (form.value?.open) form.value.close()
  }
  const dialog_click = event => {
    if (event.target === form.value) form.value.close()
  }

  const signed_in = () => {
    show_sign_in.value = false
    just_signed_in.value = true
  }

  const on_showing_mobile = visible => {
    is_mobile_form_visible.value = visible
  }

  const on_close = () => {
    layer_open.value = false
    show_sign_in.value = false
    is_mobile_form_visible.value = false
    just_signed_in.value = false
  }

  watch(
    () => current_user.value,
    (user, was) => {
      if (user && !was && form.value?.open) just_signed_in.value = true
    }
  )
  watch(
    () => route.hash,
    new_hash => {
      if (new_hash === '#account' && form.value) {
        show_sign_in.value = false
        is_mobile_form_visible.value = false
        layer_open.value = true
        form.value.show()
        form.value.focus()
      }
    }
  )

  defineExpose({ show: show_form })
</script>

<template>
  <a id="toggle-account" @click="show_form">{{ name }}</a>
  <div
    v-if="layer_open"
    class="account-dialog-backdrop"
    aria-hidden="true"
    @click="backdrop_click" />
  <dialog
    id="account"
    class="modal"
    ref="form"
    @click="dialog_click"
    @close="on_close">
    <name-as-form v-if="current_user && !show_sign_in" />
    <fieldset
      v-if="current_user && !show_sign_in && my_profile_path"
      id="view-profile">
      <legend>Profile</legend>
      <router-link :to="my_profile_path" @click="view_profile_click">
        View my profile
      </router-link>
    </fieldset>
    <as-sign-on
      v-else
      @signed_in="signed_in"
      @showing_mobile="on_showing_mobile" />
    <fieldset
      v-if="
        current_user &&
        !just_signed_in &&
        (!show_sign_in || is_mobile_form_visible)
      "
      id="sign-off">
      <legend>Sign off</legend>
      <button @click="sign_off">
        <icon name="arrow" />
      </button>
    </fieldset>
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
  dialog#account {
    & > fieldset#view-profile {
      margin-top: base-line;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: base-line * 0.25;
      border-top: 1px solid gravel;
      padding-top: base-line * 0.5;
      & > legend {
        margin-right: auto;
      }
      & > a {
        text-decoration: underline;
      }
    }
    & > fieldset#sign-off {
      margin-top: base-line;
      border-top: 1px solid red;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: base-line * 0.25;
      & > legend {
        color: red;
        margin-right: auto;
      }
      & > button {
        margin: base-line * 0.75;
        border-color: red;
        &:hover {
          background-color: red;
          color: white;
        }
        & > svg.icon {
          width: base-line;
          height: base-line;
        }
      }
    }
  }
</style>

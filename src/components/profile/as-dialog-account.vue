<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import AsSignOn from '@/components/profile/as-sign-on'
  import icon from '@/components/icon'
  import { ref, computed, watch } from 'vue'
  import { current_user, sign_off, me } from '@/utils/serverless'
  import { useRoute as use_route } from 'vue-router'
  const form = ref(null)
  const is_open = ref(false)
  const name = computed(() => me.value?.name || 'sign on')
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
      is_open.value = true
      form.value.show()
      form.value.focus()
    }
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
    is_open.value = false
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
        is_open.value = true
        form.value.show()
        form.value.focus()
      }
    }
  )

  defineExpose({ show: show_form })
</script>

<template>
  <a id="toggle-account" @click="show_form">{{ name }}</a>
  <dialog id="account" ref="form" @click="dialog_click" @close="on_close">
    <name-as-form v-if="current_user && !show_sign_in" />
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
  <div v-if="is_open" @click="form?.close()" />
</template>

<style lang="stylus">
  body:has(dialog#account[open]) {
    overflow: hidden;
  }
  #navigation a#toggle-account {
    display: block;
    position: fixed;
    top: safe_inset(top, base-line)
    left: base-line;
    & > span {
      margin-left: base-line * .5;
      line-height: 0;
      display: inline-block;
      vertical-align: middle;
    }
  }
  dialog#account {
    z-index: 9;
    position: fixed
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    border: 3px solid red;
    border-radius: base-line *.5;
    padding: base-line;

    & + div {
      position: fixed
      inset: 0
      z-index: 8;
      background-color: black-transparent
    }
    & > a {
      position: absolute;
      top: base-line * .5;
      right: base-line * .5;
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

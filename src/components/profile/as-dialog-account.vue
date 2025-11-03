<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import CallToAction from '@/components/call-to-action'
  import AsSignOn from '@/components/profile/as-sign-on'
  import { ref, onMounted as mounted, watch } from 'vue'
  import { current_user, sign_off } from '@/utils/serverless'
  import { load } from '@/utils/itemid'
  import { useRoute as use_route } from 'vue-router'

  const form = ref(null)
  const first_name = ref('You')
  const route = use_route()
  const show_sign_in = ref(false)
  const is_mobile_form_visible = ref(false)

  const show_form = () => {
    if (!form.value) return
    if (form.value.open) 
      form.value.close()
     else {
      show_sign_in.value = false
      is_mobile_form_visible.value = false
      form.value.showModal()
      // Focus the dialog itself to prevent inputs from getting focus
      form.value.focus()
    }
  }
  const dialog_click = event => {
    if (event.target === form.value) form.value.close()
  }
  const close_settings = () => {
    form.value.close()
  }

  const signed_in = () => {
    show_sign_in.value = false
    close_settings()
  }

  const on_showing_mobile = visible => {
    is_mobile_form_visible.value = visible
  }

  const on_close = () => {
    show_sign_in.value = false
    is_mobile_form_visible.value = false
  }

  // Watch for hash changes to show dialog
  watch(
    () => route.hash,
    new_hash => {
      if (new_hash === '#account' && form.value) {
        show_sign_in.value = false
        is_mobile_form_visible.value = false
        form.value.showModal()
        // Focus the dialog itself to prevent inputs from getting focus
        form.value.focus()
      }
    },
    { immediate: true }
  )

  mounted(async () => {
    // Check if we should show dialog on mount (e.g., if URL has #account)
    if (route.hash === '#account' && form.value) {
      show_sign_in.value = false
      is_mobile_form_visible.value = false
      form.value.showModal()
      // Focus the dialog itself to prevent inputs from getting focus
      form.value.focus()
    }
  })

  defineExpose({ show: show_form })
</script>

<template>
  <a id="toggle-account" @click="show_form">{{ first_name }}</a>
  <dialog id="account" ref="form" @click="dialog_click" @close="on_close">
    <name-as-form />
    <call-to-action v-if="!show_sign_in" />
    <as-sign-on
      v-else
      @signed_in="signed_in"
      @showing_mobile="on_showing_mobile" />
    <menu>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <button v-else-if="!is_mobile_form_visible" @click="show_sign_in = true">
        Sign in
      </button>
    </menu>
  </dialog>
</template>

<style lang="stylus">
  a#toggle-account {
    display: none;
  }

  #navigation a#toggle-account {
    display: block;
    position: fixed;
    top: inset(top,  base-line);
    left: base-line;
    & > span {
      margin-left: base-line * .5;
      line-height: 0;
      display: inline-block;
      vertical-align: middle;
    }
  }
  dialog#account {
    border: 3px solid red;
    border-radius: base-line *.5;
    padding: base-line;
    & > a {
      position: absolute;
      top: base-line * .5;
      right: base-line * .5;
    }
    & > menu {
      display: flex;
      justify-content: space-between;
      align-items: center;
      & > a.close > svg {
        fill: red;
      }
      & > button {
        border-color: red;
        &:hover {
          background-color: red;
          color: white;
        }
      }
    }
  }
</style>

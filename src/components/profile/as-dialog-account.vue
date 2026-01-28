<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import AsSignOn from '@/components/profile/as-sign-on'
  import icon from '@/components/icon'
  import { ref, computed, onMounted as mounted, watch } from 'vue'
  import { current_user, sign_off, me } from '@/utils/serverless'
  import { useRoute as use_route } from 'vue-router'
  import { use_me } from '@/use/people'

  const form = ref(null)
  const name = computed(() => me.value?.name || 'account')
  const route = use_route()
  const show_sign_in = ref(false)
  const is_mobile_form_visible = ref(false)
  const { is_valid_name } = use_me()

  const show_form = () => {
    if (!form.value) return
    if (form.value.open) form.value.close()
    else {
      show_sign_in.value = false
      is_mobile_form_visible.value = false
      form.value.showModal()
      form.value.focus()
    }
  }
  const dialog_click = event => {
    if (event.target === form.value && is_valid_name.value) form.value.close()
  }

  const signed_in = () => {
    show_sign_in.value = false
  }

  const on_showing_mobile = visible => {
    is_mobile_form_visible.value = visible
  }

  const on_close = () => {
    show_sign_in.value = false
    is_mobile_form_visible.value = false
  }

  watch(
    () => route.hash,
    new_hash => {
      if (new_hash === '#account' && form.value) {
        show_sign_in.value = false
        is_mobile_form_visible.value = false
        form.value.showModal()
        form.value.focus()
      }
    },
    { immediate: true }
  )

  mounted(() => {
    if (route.hash === '#account' && form.value) {
      show_sign_in.value = false
      is_mobile_form_visible.value = false
      form.value.showModal()
      form.value.focus()
    }
  })

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
    <fieldset v-if="current_user" id="sign-off">
      <legend>Sign off</legend>
      <button @click="sign_off">
        <icon name="arrow" />
      </button>
    </fieldset>
  </dialog>
</template>

<style lang="stylus">
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

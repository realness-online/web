<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import CallToAction from '@/components/call-to-action'
  import { ref, onMounted as mounted, inject, watch } from 'vue'
  import SignOn from '@/components/profile/sign-on'
  import { current_user, sign_off } from '@/utils/serverless'
  import { load } from '@/utils/itemid'
  import Icon from '@/components/icon'
  import { useRoute as use_route } from 'vue-router'

  const form = ref(null)
  const first_name = ref('You')
  const route = use_route()

  const show_form = () => form.value.showModal()
  const dialog_click = event => {
    if (event.target === form.value) form.value.close()
  }
  const close_settings = () => {
    form.value.close()
  }

  // Watch for hash changes to show dialog
  watch(
    () => route.hash,
    new_hash => {
      if (new_hash === '#account' && form.value) form.value.showModal()
    },
    { immediate: true }
  )

  mounted(async () => {
    const my = await load(localStorage.me)
    if (my?.first_name) first_name.value = my.first_name

    // Check if we should show dialog on mount (e.g., if URL has #account)
    if (route.hash === '#account' && form.value) form.value.showModal()
  })
</script>

<template>
  <a id="toggle-account" @click="show_form">{{ first_name }}</a>
  <dialog id="account" ref="form" @click="dialog_click">
    <name-as-form />
    <call-to-action />
    <menu>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <sign-on v-else />
    </menu>
  </dialog>
</template>

<style lang="stylus">
  a#toggle-account {
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

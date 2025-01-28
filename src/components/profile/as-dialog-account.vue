<script setup>
  import NameAsForm from '@/components/profile/as-form-name'
  import CallToAction from '@/components/call-to-action'
  import { ref, onMounted as mounted, inject } from 'vue'
  import SignOn from '@/components/profile/sign-on'
  import { current_user, sign_off } from '@/utils/serverless'
  import { load } from '@/utils/itemid'
  import Icon from '@/components/icon'

  /** @type {import('vue').Ref<boolean>} */
  const show_utility_components = inject('show_utility_components')

  const form = ref(null)
  const first_name = ref('You')
  const show_form = () => form.value.showModal()
  const dialog_click = event => {
    if (event.target === form.value) form.value.close()
  }
  const close_settings = () => {
    form.value.close()
  }
  mounted(async () => {
    const my = await load(localStorage.me)
    if (my?.first_name) first_name.value = my.first_name
  })
</script>

<template>
  <a v-if="show_utility_components" id="toggle-account" @click="show_form">{{
    first_name
  }}</a>
  <dialog id="account" ref="form" @click="dialog_click">
    <a @click="close_settings">
      <icon name="finished" />
    </a>
    <name-as-form />
    <call-to-action />
    <menu>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <sign-on v-else />
      <router-link to="/docs">Docs</router-link>
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
      & > svg {
        width: base-line * .75;
        height: base-line * .75;
        fill: black;
      }
    }
    & > menu {
      display: flex;
      justify-content: space-between;
      align-items: center;
      & > button {
        border-color: red;
        color: red;
        &:hover {
          background-color: red;
          color: white;
        }
      }
    }
  }
</style>

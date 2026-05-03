<script setup>
  import Icon from '@/components/icon'
  import NameAsForm from '@/components/profile/as-form-name'
  import { sign_off } from '@/utils/serverless'

  defineOptions({
    name: 'AsMenuAccount'
  })
</script>

<template>
  <menu class="as-menu-account">
    <name-as-form />
    <fieldset id="sign-off" class="as-menu-account-sign-off">
      <legend>Sign off</legend>
      <button type="button" @click="sign_off">
        <icon name="arrow" /> sign off
      </button>
    </fieldset>
  </menu>
</template>

<style lang="stylus">
  menu.as-menu-account {
    flex-direction: column
    align-items: stretch
    gap: base-line * 0.5
    max-width: page-width
    white-space: normal
  }

  fieldset.as-menu-account-sign-off
    margin: 0
    border-top: 1px solid red
    display: flex
    align-items: center
    justify-content: flex-end
    gap: base-line * 0.25
    & > legend
      color: red
      margin-right: auto
    & > button
      margin: base-line * 0.75
      border-color: red
      &:hover
        background-color: red
        color: white
      & > svg.icon
        width: base-line
        height: base-line
</style>

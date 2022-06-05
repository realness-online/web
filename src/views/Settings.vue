<template>
  <section id="settings" class="page">
    <header>
      <icon name="nothin" />
      <logo-as-link />
    </header>
    <h1>Settings</h1>
    <menu>
      <li>
        <name-as-form />
      </li>
    </menu>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import NameAsForm from '@/components/profile/as-form-name'
</script>
<style lang="stylus">
  section#settings
    a
      color: green
      border-color: green
    h1, svg.icon
      margin:0
      color: red
      fill: red
    & > details
      & > summary
      & > article
        padding: 0 base-line
    menu
      margin: base-line
      & > li
        list-style: none
        margin-bottom: base-line
</style>

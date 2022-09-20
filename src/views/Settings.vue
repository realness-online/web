<template>
  <section id="settings" class="page">
    <header>
      <icon name="nothin" />
      <logo-as-link />
    </header>
    <h1>Settings</h1>
    <menu>
      <h2>Posters</h2>
      <li>
        <preference name="emboss" title="Apply the emboss filter" />
      </li>
      <li>
        <preference
          name="filesystem"
          title="Use the filesystem api to sync posters on your desktop" />
      </li>
      <li>
        <preference
          name="adobe"
          title="Posters download without CSS and use HEX for color" />
      </li>
    </menu>
    <menu>
      <h2>Me</h2>
      <li>
        <name-as-form />
      </li>
    </menu>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
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
      standard-grid: 'nothing'
      margin: base-line
      & > li
        list-style: none
        margin-bottom: base-line
</style>

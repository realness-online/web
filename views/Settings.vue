<template>
  <section id="settings" class="page">
    <header>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <sign-on v-else />
      <logo-as-link />
    </header>
    <h1>Settings</h1>
    <menu>
      <name-as-form />
      <preference
        name="emboss"
        title="Apply an emboss effect to each layer of a poster" />
      <preference
        name="animate"
        title="Animate posters as they come into view" />
      <preference
        name="adobe"
        title="Posters download with HEX (#FFF000) values for color" />
      <preference
        hidden
        name="filesystem"
        title="sync posters with a directory"
        subtitle="on an iphone this will save piture and exif info that you can sync on the a desktop machine"
        @on="set_posters_folder">
      </preference>
    </menu>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import LogoAsLink from '@/components/logo-as-link'
  import NameAsForm from '@/components/profile/as-form-name'
  import SignOn from '@/components/profile/sign-on'
  import { current_user, sign_off } from '@/use/serverless'
  import { get_file_system } from '@/use/file'
  const set_posters_folder = async () => {
    get_file_system()
  }
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
        height: 100%
        list-style: none
        margin-bottom: base-line
</style>

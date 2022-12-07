<template>
  <section id="settings" class="page">
    <header>
      <icon name="nothin" />
      <logo-as-link />
    </header>
    <h1>Settings</h1>
    <menu>
      <h2 style="grid-row: 1 / span 2">Posters</h2>
      <preference
        name="emboss"
        title="Apply an emboss effect to each layer of a poster" />
      <preference
        name="animate"
        title="Animate the individual paths of a posters when focused" />
      <preference
        name="filesystem"
        title="Use the filesystem api to sync posters on your desktop">
        <a @click="set_posters_folder">
          <icon name="download" />
        </a>
      </preference>
      <preference
        name="adobe"
        title="Posters download without CSS and use HEX for color" />
    </menu>
    <menu>
      <h2>Me</h2>
      <name-as-form />
    </menu>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import LogoAsLink from '@/components/logo-as-link'
  import NameAsForm from '@/components/profile/as-form-name'

  const set_posters_folder = async () => {
    const root = await navigator.storage.getDirectory()
    // const untitledFile = await root.getFileHandle('Untitled.txt', {
    //   create: true
    // })
    const new_dir = await root.getDirectoryHandle('Posters', {
      create: true
    })
    console.log(new_dir)
    // ;[file_handle] = await window.showDirectoryPicker()
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

<template>
  <section id="settings" class="page">
    <header>
      <icon name="nothin" />
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
        title="Rotate gradients"
        subtitle="A subtle wobble when a poster is focused" />
      <preference
        name="adobe"
        title="Posters download with HEX (#FFF000) values for color" />
      <preference
        name="filesystem"
        title="Use the filesystem api to sync posters on your desktop">
        <a @click="set_posters_folder">
          <icon name="download" />
        </a>
      </preference>
      <preference
        hidden
        name="social"
        title="Use the social networking features. silk screens become posters and are automatically synced with the network" />
      <preference
        hidden
        name="robot"
        title="Use Machine learning camera. This is unusable" />
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

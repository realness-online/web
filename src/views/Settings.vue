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
    <article hidden>
      <h3>Coming Soon</h3>
      <p>
        Your <a href="https://cash.app/$ScottFryxell">support</a> creates the
        space to unlock a universe of functionality around vector graphics
      </p>
      <ol>
        <li>
          <button disabled @click="toggle('sync:netwok')">GPU</button>
          Emboss posters
        </li>
        <li>
          <button disabled @click="toggle('fullscreen')">
            <icon name="fullscreen" />
          </button>
          Fullscreen — <kbd>Ctrl</kbd> + <kbd>F</kbd>
        </li>
        <li><button disabled>Animate audio input</button></li>
        <li><button disabled>Chat</button></li>
        <li><button disabled>Stream</button></li>

        <h4>Sync realness</h4>
        <li><button disabled>Filesystem</button></li>
        <li><button disabled>Devices</button></li>
        <li><button disabled>Contacts</button></li>
      </ol>
    </article>
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

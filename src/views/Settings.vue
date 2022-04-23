<template>
  <section id="settings" class="page">
    <header>
      <h1>Settings</h1>
      <logo-as-link />
    </header>
    <menu>
      <li>
        <button @click="toggle('sync:netwok')">Sync</button>
        with network
      </li>
      <li>
        <button v-if="current_user" @click="signoff">Sign off</button>
        <sign-on v-else />
      </li>
      <li>
        <router-link to="/documentation">Documentation</router-link>
        on realness
      </li>
    </menu>
    <details>
      <summary>Coming Soon</summary>
      <article>
        <h3>Product Roadmap</h3>
        <p>
          Your <a href="https://cash.app/$ScottFryxell">support</a> creates the
          space to unlock a universe of functionality around vector graphics
        </p>
        <ol>
          <li>
            <button disabled @click="toggle('sync:netwok')">GPU</button>
            Disable GPU ehancments on slower machines
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
    </details>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import SignOn from '@/components/profile/sign-on'
  import { current_user } from '@/use/serverless'
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
    menu, ol
      padding: base-line
      display: flex
      flex-direction: column
      justify-content: space-around
      & > li
        list-style: none
        margin-bottom: base-line
        &:last-of-type
          margin-bottom: 0
      & > button:disabled
        color: inherit
</style>

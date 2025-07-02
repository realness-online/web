<script setup>
  import Preference from '@/components/preference'
  import LogoAsLink from '@/components/logo-as-link'
  import CallToAction from '@/components/call-to-action'
  import NameAsForm from '@/components/profile/as-form-name'
  import SignOn from '@/components/profile/sign-on'

  import { ref } from 'vue'
  import { current_user, sign_off } from '@/utils/serverless'
  import { get_file_system } from '@/utils/file'
  import { use_keymap } from '@/use/key-commands'

  const set_posters_folder = () => get_file_system()
  console.time('views:Settings')
  const working = ref(true)
  const { register } = use_keymap('Settings')
  register('settings::Save', () => console.log('TODO: Save settings'))
  register('settings::Reset', () => console.log('TODO: Reset settings'))
  register('settings::Import', () =>
    console.log('TODO: Import settings from other realness')
  )
</script>

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
      <preference name="fill" title="Use a gradient to fill up your poster" />
      <preference
        name="stroke"
        title="Outline your graphic with a stroke in relevant color" />
      <preference name="animate" title="Animate posters">
        <preference
          name="fps"
          title="show frames per second on the bottom right" />
      </preference>
      <preference
        name="emboss"
        title="Apply an emboss effect to each layer of a poster">
      </preference>
      <preference name="light" title="A subtle lightbar" />
      <preference
        name="adobe"
        hidden
        title="Posters download with HEX (#FFF000) values for color" />
      <preference
        hidden
        name="simple"
        title="Download posters with simple readable ids " />
      <preference
        hidden
        name="filesystem"
        title="Sync posters with a directory"
        subtitle="On an iphone this will save piture and exif info that you can sync on the a desktop machine"
        @on="set_posters_folder" />
      <call-to-action />
    </menu>
  </section>
</template>

<style lang="stylus">
  section#settings {
    h6 {
      text-align:center
    }
    .download {
      display: inline-block
      width: var(--base-line) * .75
      height: var(--base-line) * .75
    }
    a {
      color: green
      border-color: green
    }
    h1, svg.icon {
      margin:0
      color: red
      fill: red
    }
    & > details > summary {
      display: inline-block
      margin: 0
      padding: 0
      & > h3 {
        display: inline-block
        margin: 0
        padding: 0
      }
      & > article {
        padding: 0 base-line
      }
    }
    & > form {
      standard-grid: 'nothing'
      margin: base-line
      & > *:not(:last-child) {
        height: 100%
        list-style: none
        margin-bottom: base-line
      }
      & > fieldset {
        & > kbd {
          line-height: 4
        }
        & > legend {
          color:green
          margin-bottom: base-line * 0.55
        }
      }
    }
    & > menu {
      standard-grid: 'nothing'
      margin: base-line
      & > *:not(:last-child) {
        height: 100%
        list-style: none
        margin-bottom: base-line
      }
      & > details {
        & > summary > h3 {
          display: inline-block
          margin: 0
          padding: 0
        }
        & > h4 {
          margin-top: base-line
        }
      }
    }
  }
</style>

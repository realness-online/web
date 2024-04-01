<template>
  <section id="settings" class="page">
    <header>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <sign-on v-else />
      <logo-as-link />
    </header>
    <h1>Settings</h1>
    <name-as-form />
    <menu>
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
        title="Sync posters with a directory"
        subtitle="On an iphone this will save piture and exif info that you can sync on the a desktop machine"
        @on="set_posters_folder">
      </preference>
      <details>
        <summary><h3>Documentation</h3></summary>
        <h4>
          <router-link to="/about" tabindex="-1">
            Drawing and Vector Graphics Workflows
          </router-link>
        </h4>
        <p>
          By default, Realness supports vector workflows. Take a picture, and
          Realness will create a good-looking rotoscope vector graphic. Each
          photo has twelve gradients for you to pull color from. Realness
          integrates right into Figma or Adobe toolchains.
        </p>
        <p>
          Realness is fast. Save it to your home screen on your phone and iPad.
          No matter the device, you get a fun experience.
        </p>
        <h5>Name</h5>
        <p>
          Fill out your name; nice. If you choose to sign in, you will show up
          in the phonebook. People can message you directly. Realness is
          technically the dark web as it's blind to search engines and
          advertising.
        </p>
        <h5>Sync</h5>
        <p>
          Home screen installable. You can sync Realness across all your
          devices. Take a picture on your phone and send it to Procreate from
          your iPad.
        </p>
        <p>Realness updates at eight-hour intervals.</p>
        <h6>Lighten Our Burden</h6>
        <h5>Settings</h5>
        <p>These settings are off because they are resource-expensive.</p>
        <p>Embossing the borders looks amazing, adding a subtle flair.</p>
        <p>
          Animations will look great if you have a beefy GPU. Just go to your
          posters to see them all animating at once.
        </p>
        <p>
          SVG's work great for most design tools. If you want to use your poster
          in Procreate You'll need to convert it to PSD with Affinity Designer
          or Adobe Illustrator
        </p>
      </details>
    </menu>
    <call-to-action />
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import Preference from '@/components/preference'
  import LogoAsLink from '@/components/logo-as-link'
  import CallToAction from '@/components/call-to-action'
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
    h6
      text-align:center
    .download
      display: inline-block
      width: base-line * .75
      height: base-line * .75
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
      & > details
        & > summary > h3
          display: inline-block
          // line-height: 1
          margin: 0
          padding: 0
        & > h4
          margin-top: base-line
      & > li
        height: 100%
        list-style: none
        margin-bottom: base-line
</style>

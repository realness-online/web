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
      <preference name="rasterize" title="Download posters as png" />
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
        <h4>Drawing, and vector graphics workflows</h4>
        <p>
          By default realness supports vector worflows. Take a picute. and
          realness will create a good looking rotoscope vector graphic. each
          photo has twelve gradients for you to pull color from. Realness
          integrates right into figma or adobe toolchains.
        </p>
        <p>
          Realness is fast. Save it to your homescreen on your phone and ipad.
          No matter the device you get a fun experience.
        </p>

        <h5>Settings</h5>
        <p>
          These settings are off because they are resource expensive. Embossing
          the borders looks amazing adding a subtle flairbut but is expensive
          and will bog down slower devices.
        </p>
        <p>
          Anmimations are expensive but will look great if you have a beefy GPU.
        </p>
        <p>
          Sending your poster into procreate is fully supported via rasterize. .
          Clicking the download Icon <icon name="download" /> will create a png
          and give you the option to send it directly to procreate. We've made
          these graphics large so that you can zoom into them and They'll still
          look great.
        </p>
      </details>
    </menu>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
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

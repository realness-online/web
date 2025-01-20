<script setup>
  import Preference from '@/components/preference'
  import LogoAsLink from '@/components/logo-as-link'
  import CallToAction from '@/components/call-to-action'
  import NameAsForm from '@/components/profile/as-form-name'
  import SignOn from '@/components/profile/sign-on'

  import { current_user, sign_off } from '@/utils/serverless'
  import { get_file_system } from '@/utils/file'
  const set_posters_folder = () => get_file_system()
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
      <details>
        <summary><h3>Documentation</h3></summary>
        <h4>
          <router-link to="/about" tabindex="-1">
            Drawing and Vector Graphics Workflows
          </router-link>
        </h4>
        <p>
          By default, Realness supports vector workflows. Take a picture, and
          Realness will create a super fun rotoscope vector graphic. Each photo
          has eighteen gradients for you to pull color from. Realness integrates
          right into Figma, Affinity, Procreate, or Adobe toolchains.
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
        <p>
          These settings are off because they are resource-expensive, or
          workflow specific.
        </p>
        <p>
          By default a Poster's internal IDs are globally unique which makes
          them safe to embed and reference in the same document.
        </p>
        <p>
          Simplifying ids makes layers more readable as you export into other
          tools.
        </p>
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
      <call-to-action />
    </menu>
  </section>
</template>

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
    & > form
      standard-grid: 'nothing'
      margin: base-line
      & > *:not(:last-child)
        height: 100%
        list-style: none
        margin-bottom: base-line
      & > fieldset
        & > kbd
          line-height: 4
        & > legend
          color:green
          margin-bottom: base-line * 0.55
    & > menu
      standard-grid: 'nothing'
      margin: base-line
      & > *:not(:last-child)
        height: 100%
        list-style: none
        margin-bottom: base-line
      & > details
        & > summary > h3
          display: inline-block
          // line-height: 1
          margin: 0
          padding: 0
        & > h4
          margin-top: base-line
</style>

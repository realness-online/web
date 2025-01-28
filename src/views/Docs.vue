<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  console.info('views:documentation')
</script>

<template>
  <section id="documentation" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <h1>Documentation</h1>
    <article>
      <header>
        <h3>
          Drawing and Vector Graphics
          <router-link to="/about">Workflows</router-link>
        </h3>
      </header>
      <p>
        Realness is fast. It works best on a phone when you save it to your home
        screen. No matter the device, you get a fun experience.
      </p>
      <p>
        Realness supports vector workflows. Take a picture, and Realness will
        create a super fun rotoscope vector graphic. Each photo has eighteen
        gradients for you to pull color from. Realness integrates right into
        Figma, Affinity, Procreate, or Adobe toolchains.
      </p>

      <h5>Name</h5>

      <p>
        Fill out your name; nice. If you choose to sign in, you will show up in
        the phonebook. People can message you directly. Realness it's blind to
        search engines and has no tracking or advertising.
      </p>

      <h5>Sync</h5>

      <p>
        You can sync Realness across all your devices. Take a picture on your
        phone and then open realness on your ipad and send it to Procreate (via
        affinity designer).
      </p>

      <p>Realness updates at eight-hour intervals.</p>

      <p>
        Settings can be changed via the gear icon at the bottom of the screen
      </p>

      <p>
        SVG's work great for most design tools. If you want to use your poster
        in Procreate You'll need to convert it to PSD with Affinity Designer or
        Adobe Illustrator
      </p>
    </article>
  </section>
</template>

<style lang="stylus">
  section#documentation > article {
    max-width: page-width;
    margin: 0 auto;
  }
</style>

<template>
  <section id="player" class="page" outline>
    <header>
      <audio-visualizer />
      <logo-as-link tabindex="-1" />
    </header>
    <h1>Play Thots</h1>
    <menu> </menu>
  </section>
</template>
<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AudioVisualizer from '@/components/audio/visualizer'
</script>
<style lang="stylus">
  section#player
    & > menu
      padding: base-line
</style>

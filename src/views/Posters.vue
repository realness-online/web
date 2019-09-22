<template>
  <section id="posters" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Posters</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <header>
      <h1></h1>
    </header>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import logoAsLink from '@/components/logo-as-link'
  export default {
    components: {
      logoAsLink,
      icon
    },
    data() {
      return {
        working: false
      }
    }
  }
</script>
<style lang="stylus">
  section#posters
    h1
      color: green
    & > header
      margin: auto
      max-width: page-width
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
</style>

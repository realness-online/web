<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Events</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <figure>
      <as-avatar v-for="person in curators" :person="person"></as-avatar>
    </figure>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import asAvatar from '@/components/profile/as-avatar'
  import icon from '@/components/icon'
  export default {
    components: {
      logoAsLink,
      asAvatar,
      icon
    },
    data() {
      return {
        curators: [],
        working: true
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    h1
      color: green
    & > header
      margin: auto
      padding: base-line
      max-width: page-width
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
    & > figure
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      @media (min-width: max-screen)
        padding: 0 base-line
      & > svg
        display: block
        width: 100%
        min-height: 66vh
        height: inherit

</style>

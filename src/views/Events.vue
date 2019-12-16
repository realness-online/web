<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Tonight!</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <figure>
      <as-avatar v-for="person in curators" :key="person.id" :person="person"></as-avatar>
    </figure>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import logo_as_link from '@/components/logo-as-link'
  import as_svg from '@/components/avatars/as-svg'
  import icon from '@/components/icon'
  export default {
    mixins: [signed_in],
    components: {
      'logo-as-link': logo_as_link,
      'as-avatar': as_svg,
      icon
    },
    data() {
      return {
        curators: [],
        working: false
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
      @media (min-width: mid-screen)
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

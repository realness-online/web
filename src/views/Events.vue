<template>
  <section id="events" class="page">
    <header>
      <icon name=""></icon>
      <h1>Events</h1>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <figure>
      <as-avatar v-for="person in curators" :person="person"></as-avatar>
    </figure>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import asAvatar from '@/components/profile/as-avatar'
  import profile_id from '@/modules/profile_id'
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
    },
    created() {
      // Ned Tomo and Scott
      // Soon Dylan and Reeves
      ['/+14158711557', '/+14157220394', '/+16282281824'].forEach(id => {
        profile_id.load(id).then(person => {
          this.curators.push(person)
          this.working = false
        })
      })
    }
  }
</script>
<style lang="stylus">
  section#events
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
      padding: 0 base-line
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      & > svg
        display: block
        width: 100%
        min-height: 66vh
        height: inherit

</style>

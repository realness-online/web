<template>
  <section id="events" class="page">
    <header>
      <icon name=""></icon>
      <h1>Events</h1>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <figure>
      <svg v-for="person in curators">
        <defs itemprop="avatar" v-html="person.avatar"></defs>
        <use :xlink:href="avatar_link(person.id)"/>
      </svg>
    </figure>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import profileAsList from '@/components/profile/as-list'
  import { relations_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import icon from '@/components/icon'
  export default {
    components: {
      logoAsLink,
      profileAsList,
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
    },
    methods: {
      avatar_link(item_id){
        return profile_id.as_avatar_fragment(item_id)
      }
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  section#events
    margin-top: 0
    // padding: 0
    & > header
      margin-bottom: base-line
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
      & > svg
        // box-shadow: -1px 0px 0px black
        display: block
        width: 100%
        min-height: 66vh
        // min-width: 50vw
        height: inherit

</style>

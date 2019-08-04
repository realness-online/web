<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phone-book"><icon name="heart"></icon></router-link>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Friends</h1>
    </hgroup>
    <profile-as-list :people='relations'></profile-as-list>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  import profile_id from '@/helpers/profile'
  import relationship_events from '@/mixins/relationship_events'
  export default {
    mixins: [relationship_events],
    components: {
      icon,
      profileAsList,
      profileAsLinks,
      logoAsLink
    },
    created() {
      this.fill_in_relationships()
    },
    methods: {
      fill_in_relationships() {
        this.relations.forEach(async(relation, index) => {
          const profile = await profile_id.load(relation.id)
          this.relations.splice(index, 1, profile)
        })
      }
    }
  }
</script>
<style lang='stylus'>
  section#relations
    & > header
      max-width: page-width
      margin: auto
    svg
      fill: blue
      &.working
        margin-bottom: base-line
</style>

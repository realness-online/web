<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phonebook"><icon name="heart"></icon></router-link>
      <h1>Friends</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list :people='relations'></profile-as-list>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  import profile_id from '@/modules/profile_id'
  import relationship_events from '@/mixins/relationship_events'
  export default {
    mixins: [relationship_events],
    components: {
      icon,
      profileAsList,
      profileAsLinks,
      logoAsLink
    },
    mounted() {
      this.fill_in_relationships()
    },
    methods: {
      fill_in_relationships() {
        return new Promise((resolve, reject) => {
          this.relations.forEach((relation, index) => {
            profile_id.load(relation.id).then(profile => {
              this.relations.splice(index, 1, profile)
              resolve('finished fill_in_relationships')
            })
          })
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

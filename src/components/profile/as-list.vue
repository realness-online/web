<template lang="html">
  <nav class="profile-list">
    <as-figure v-for="person in people" :key="person.id" :person="person">
      <as-relationship-options :person="person"
                               :relations="relations"
                               @remove="remove_relationship"
                               @add="add_relationship" />
    </as-figure>
    <profile-as-links :people="relations" />
  </nav>
</template>
<script>
  import profile_as_links from '@/components/profile/as-links'
  import as_figure from '@/components/profile/as-figure'
  import as_options from '@/components/profile/as-relationship-options'
  import itemid from '@/helpers/itemid'
  import { Relations } from '@/persistance/Storage'
  export default {
    components: {
      'profile-as-links': profile_as_links,
      'as-figure': as_figure,
      'as-relationship-options': as_options
    },
    props: {
      people: {
        type: Array,
        required: true
      }
    },
    data () {
      return {
        relations: []
      }
    },
    async created () {
      this.relations = await itemid.list(`${localStorage.me}/relations`)
    },
    methods: {
      async add_relationship (person) {
        this.relations.push(person)
        await this.$nextTick()
        new Relations().save()
      },
      async remove_relationship (person) {
        const index = this.relations.findIndex(p => (p.id === person.id))
        if (index > -1) {
          this.relations.splice(index, 1)
          await this.$nextTick()
          new Relations().save()
        }
      }
    }
  }
</script>
<style lang="stylus">
  nav.profile-list
    display: grid
    grid-gap: base-line
    grid-template-columns: repeat(auto-fill, minmax((base-line * 9), 1fr))
    @media (min-width: pad-begins)
      padding: 0 base-line
      & > figure
        standard-border: blue
        & > svg
          border-radius: 0

</style>

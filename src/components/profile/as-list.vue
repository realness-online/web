<template lang="html">
  <div>
    <profile-as-links :people="relations" />
    <nav class="profile-list">
      <li v-for="person in people" :key="person.id">
        <as-figure :person="person" />
        <as-relationship-options :me="me"
                                 :person="person"
                                 :relations="relations"
                                 @remove="remove_relationship"
                                 @add="add_relationship" />
      </li>
    </nav>
  </div>
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
      this.relations = await itemid.list(`${this.me}/relations`)
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
    padding: 0 base-line
    & > li
      margin-bottom: base-line
      list-style: none
      display: flex
      justify-content: space-between
      & > figure > figcaption a
        color:blue
    @media (min-width: pad-begins)
      display: flex
      flex-direction: row
      flex-wrap: wrap
      justify-content: space-between
      & > li
        padding: (base-line / 2)
        standard-border: blue
        width:49%
    @media (min-width: typing-begins)
      & > li
        width:32%
</style>

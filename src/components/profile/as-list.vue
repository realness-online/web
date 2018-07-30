<template lang="html">
  <nav class="profile-list">
    <li v-for="person in people">
      <as-figure :person="person"></as-figure>
      <as-relationship-options :person="person"></as-relationship-options>
    </li>
  </nav>
</template>
<script>
  import as_figure from '@/components/profile/as-figure'
  import as_options from '@/components/profile/as-relationship-options'
  import icon from '@/components/icon'
  import {relations_storage} from '@/modules/Storage'
  export default {
    props: ['people'],
    components: {
      'as-figure': as_figure,
      'as-relationship-options': as_options,
      icon
    },
    methods: {
      update_relationship(person) {
        if (this.is_relation(person)) {
          this.$bus.$emit('remove-relationship', person)
        } else {
          this.$bus.$emit('add-relationship', person)
        }
      },
      what_icon(candidate) {
        if (this.is_relation(candidate)) {
          return 'remove'
        } else {
          return 'add'
        }
      },
      is_relation(person) {
        return relations_storage.as_list().some((relation) => {
          return (relation.mobile === person.mobile)
        })
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  nav.profile-list
    & > li
      margin-top: base-line
      list-style: none
      display: flex
      justify-content: space-between
      & > figure
        & > figcaption a
          color:blue
        & svg
          fill:blue
    @media (min-width: min-screen)
      display: flex
      flex-direction: row
      flex-wrap: wrap
      justify-content: space-between
      & > li
        padding: (base-line / 2)
        standard-border: blue
        border-radius: (base-line / 3)
        width:49%
    @media (min-width: max-screen)
      & > li
        width:32%
</style>

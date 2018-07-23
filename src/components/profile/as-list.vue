<template lang="html">
  <nav class="profile-index">
    <li v-for="person in people">
      <profile-as-figure :person="person"></profile-as-figure>
      <menu>
        <a v-on:click="update_relationship(person)"><icon :name="what_icon(person)"></icon></a>
      </menu>
    </li>
  </nav>
</template>
<script>
  import as_figure from '@/components/profile/as-figure'
  import icon from '@/components/icon'
  import {relations_storage} from '@/modules/Storage'
  export default {
    props: ['people'],
    components: {
      'profile-as-figure': as_figure,
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
  nav.profile-index
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
      & > menu
        display: inline-flex
        align-items: center;
        margin-left:  (base-line / 2)
        svg
          cursor: pointer;
          fill:blue
          width: (base-line * 2)
          height: (base-line * 2)
          &:active
            width: (base-line * 1.66)
            height: (base-line * 1.66)
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

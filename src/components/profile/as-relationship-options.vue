<template>
  <menu>
    <a v-bind:class="{relation}" v-on:click="update_relationship">
      <icon name="add"></icon>
      <icon name="remove"></icon>
    </a>
  </menu>
</template>
<script>
  import icon from '@/components/icon'
  import {relations_storage} from '@/modules/Storage'
  export default {
    props: ['person'],
    components: {
      icon
    },
    data() {
      return {
        relation: this.is_relation()
      }
    },
    methods: {
      is_relation() {
        return relations_storage.as_list().some((relation) => {
          return (relation.mobile === this.person.mobile)
        })
      },
      update_relationship() {
        if (this.relation) {
          this.relation = false
          this.$bus.$emit('remove-relationship', this.person)
        } else {
          this.relation = true
          this.$bus.$emit('add-relationship', this.person)
        }
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  .profile-list li >  menu
    display: inline-flex
    align-items: center;
    margin-left:  (base-line / 2)
    & > a
      svg.remove
        display: none 
    & > a.relation
      svg.remove
        display: block
      svg.add
        display: none
    svg
      cursor: pointer;
      fill:blue
      width: (base-line * 2)
      height: (base-line * 2)
      &:active
        width: (base-line * 1.66)
        height: (base-line * 1.66)
</style>

<template>
  <menu>
    <a v-if="!is_me" v-bind:class="{relation}" v-on:click="update_relationship">
      <icon name="add"></icon>
      <icon name="remove"></icon>
    </a>
  </menu>
</template>
<script>
  import icon from '@/components/icon'
  import { relations_storage, person_storage } from '@/modules/Storage'
  export default {
    props: {
      person: Object,
      me: {
        type: Boolean,
        default: false
      }
    },
    components: {
      icon
    },
    data() {
      return {
        relation: this.is_relation()
      }
    },
    computed: {
      is_me() {
        return person_storage.as_object().id === this.person.id
      }
    },
    methods: {
      is_relation() {
        return relations_storage.as_list().some((relation) => {
          return (relation.id === this.person.id)
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
  .profile-list li >  menu
    display: inline-flex
    align-items: center;
    margin-left:  (base-line / 2)
    & > a
      width: (base-line * 2)
      height: (base-line * 2)
      svg
        transition: fill
        transition-duration: 0.5s
        cursor: pointer;
        fill:blue
        &.remove
          fill:red
          height: 0
          width: 0
      &.relation
        svg.add
          fill:red
          height: 0
          width: 0
        svg.remove
          fill:blue
          width: (base-line * 2)
          height: (base-line * 2)
</style>

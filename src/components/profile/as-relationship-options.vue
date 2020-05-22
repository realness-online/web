<template>
  <menu>
    <a v-if="!is_me" :class="{relation}" @click="update_relationship">
      <icon name="add"/>
      <icon name="remove"/>
    </a>
  </menu>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
    props: {
      person: {
        type: Object,
        required: true
      },
      relations: {
        type: Array,
        required: true
      }
    },
    data () {
      return {
        relation: this.is_relation()
      }
    },
    computed: {
      is_me () {
        return (this.me === this.person.id)
      }
    },
    methods: {
      is_relation () {
        return this.relations.some(relation => {
          return (relation.id === this.person.id)
        })
      },
      update_relationship () {
        if (this.relation) {
          this.relation = false
          this.$emit('remove', this.person)
        } else {
          this.relation = true
          this.$emit('add', this.person)
        }
      }
    }
  }
</script>
<style lang="stylus">
  .profile-list li >  menu
    display: inline-flex
    align-items: center
    margin-left:  (base-line / 2)
    & > a
      width: (base-line * 2)
      height: (base-line * 2)
      svg
        transition: fill
        transition-duration: 0.5s
        cursor: pointer
        fill: blue
        &.remove
          fill: red
          height: 0
          width: 0
      &.relation
        svg.add
          fill: red
          height: 0
          width: 0
        svg.remove
          fill: blue
          width: (base-line * 2)
          height: (base-line * 2)
</style>

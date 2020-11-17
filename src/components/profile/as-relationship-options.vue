<template>
  <a v-if="!is_me" class="status" :class="{ relation }" @click="update_relationship">
    <icon name="add" />
    <icon name="remove" />
  </a>
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
        return (localStorage.me === this.person.id)
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
    figure.profile > figcaption > menu > a.status
      svg
        width: 2rem
        height: 2rem
        transition: fill, width, height
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
          width: 1.5rem
          height: 1.5rem
</style>

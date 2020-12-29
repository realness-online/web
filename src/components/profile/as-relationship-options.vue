<template>
  <a v-if="!is_me" class="status" :class="{ relation }" @click="update_relationship">
    <icon name="add" />
    <icon name="finished" />
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
        transition: fill, width, height
        transition-duration: 0.5s
        cursor: pointer
        fill: blue
        width:  2em
        height: 2em
        &.finished
          fill: green
          height: 0
          width: 0
      &.relation
        svg.add
          height: 0
          width: 0
        svg.finished
          width:  2em
          height: 2em
</style>

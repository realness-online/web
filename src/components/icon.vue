<template>
  <svg :class="name" class="icon"><use :href="icon_location" /></svg>
</template>
<script>
  import icons from '@/style/icons.svg'
  export default {
    props: {
      name: {
        type: String,
        required: true
      }
    },
    computed: {
      icon_location() {
        return `${icons}#${this.name}`
      }
    }
  }
</script>
<style lang="stylus">
  svg.icon
    filter: drop-shadow( -1px -1px 1.5px black-dark) // the sun is coming from the bottom right
</style>

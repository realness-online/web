<template>
  <svg :class="name" class="icon"><use :href="icon_location" /></svg>
</template>
<script>
  import icons from '/public/icons.svg'
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
  svg.icon:active
    transform: scale(0.95)
    outline: 1px double currentColor
    outline-offset: base-line * 0.25
  svg.icon.gear:active
    transition-timing-function: ease
    transition-duration: 0.66s
    transition-property: all
    fill:green
    transform: rotate(60deg) scale(0.95)
</style>

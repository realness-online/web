<template lang="html">
  <svg :class='name'><use :xlink:href="icon_location"/></svg>
</template>
<script>
  import icons from '@/icons.svg'
  export default {
    props: ['name'],
    computed: {
      icon_location () {
        return `${icons}#${this.name}`
      }
    }
  }
</script>

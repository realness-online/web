<template lang="html">
  <svg :class='id'><use :xlink:href="icon_location"/></svg>
</template>
<script>
  import icons from '@/icons.svg'
  export default {
    props: ['id'],
    computed: {
      icon_location() {
        return `${icons}#${this.id}`
      }
    }
  }
</script>

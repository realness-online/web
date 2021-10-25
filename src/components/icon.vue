<template>
  <svg :class="name"><use :href="icon_location" /></svg>
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

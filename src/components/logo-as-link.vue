<script>
  import icon from '@/components/icon'
  export default {
    name: 'LogoAsLink',
    components: { icon }
  }
</script>

<template>
  <router-link class="logo" to="/" tabindex="-1">
    <icon name="realness" />
  </router-link>
</template>

<style lang="stylus">
  svg.realness:active {
    outline: 1px double currentColor;
    outline-offset: base-line * 0.25;
    transition-property: all;
    transition-duration: 0.21s;
    transform: scale(0.95);
  }
</style>

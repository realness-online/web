<template lang="html">
  <section id="editor" class="page">
    <header>
      <icon name="remove" />
      <h1>Edit</h1>
      <icon name="finished" />
    </header>
    <as-svg :itemid="itemid" :immediate="true" :tabable="true" />
    <menu>
      <icon name="description" />
      <icon name="opacity" />
      <icon name="point" />
      <icon name="grid" />
    </menu>
  </section>
</template>

<script>
  import icon from '@/components/icon'
  import as_svg from '@/components/posters/as-svg'
  export default {
    components: {
      icon,
      'as-svg': as_svg
    },
    data () {
      return {
        itemid: `${localStorage.me}/posters/${this.$route.params.id}`
      }
    }
  }
</script>
<style lang="stylus">
  section#editor
    & > svg
      position: fixed
      top: 0
      bottom: 0
      left: 0
      right: 0
    & > header
      position: relative;
      z-index:2
    & > header > svg
    & > menu > svg
      cursor: pointer
      fill: spin(green, 3deg)
      &.point
      &.grid
        border:1px solid green
        border-radius: base-line * .1
    & > header > h1
      color: green
    & > menu
      position: fixed
      bottom: base-line
      left: base-line
      right: base-line
      display: flex
      justify-content: space-between

</style>

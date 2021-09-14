<template lang="html">
  <section id="editor" class="page">
    <header>
      <h1>Edit</h1>
      <router-link class="remove" to="/posters">
        <icon name="remove" tabindex="-1" />
      </router-link>
      <a class="fullscreen" @click="go_big">
        <icon name="fullscreen" tabindex="-1" />
      </a>
      <a @click="save">
        <icon name="finished" tabindex="-1" />
      </a>
    </header>
    <as-svg :itemid="itemid" :immediate="true" :tabindex="-1" :slice="false" :tabable="true" />
    <menu>
      <icon name="description" tabindex="-1" />
      <icon name="opacity" tabindex="-1" />
      <icon name="grid" tabindex="-1" />
      <icon name="animation" tabindex="-1" />
    </menu>
    <aside>
      <p><kbd>ctrl+</kbd></p>
    </aside>
  </section>
</template>

<script>
  import icon from '@/components/icon'
  import as_svg from '@/components/posters/as-svg'
  import fullscreen from '@/mixins/fullscreen'
  export default {
    components: {
      icon,
      'as-svg': as_svg
    },
    mixins: [fullscreen],
    data () {
      return {
        itemid: `${localStorage.me}/posters/${this.$route.params.id}`
      }
    },
    methods: {
      save () {
        console.log('save')
      }
    }
  }
</script>
<style lang="stylus">
  section#editor
    &:fullscreen
    &:full-screen
      & > header > a.fullscreen
        visibility: hidden
    & > svg
      position: fixed
      z-index: 1
      top: 0
      bottom: 0
      left: 0
      right: 0
    & > header
      & > h1
      & > a
        position: sticky
        z-index: 2
      & > a
        height: base-line
    & > header > a  > svg
    & > menu > svg
      cursor: pointer
      stroke-width: base-line * 0.1
      stroke: spin(green, 3deg)
      stroke-opacity: 0.25
      fill-opacity: 0.25
      &.remove
      &.opacity
      &.fullscreen
        fill: spin(green, 3deg)
        fill-opacity: inherit
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

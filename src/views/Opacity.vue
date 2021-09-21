<template lang="html">
  <section id="editor" v-hotkey="keymap" class="page">
    <header>
      <h4>Opacity</h4>
      <a class="fullscreen" @click="go_big">
        <icon name="fullscreen" />
      </a>
      <icon name="nothing" />
      <a @click="back">
        <icon name="remove" />
      </a>
      <a @click="save">
        <icon name="finished" />
      </a>
    </header>
    <as-svg :itemid="itemid" :immediate="true" :tabindex="-1" :slice="false" :tabable="true" />
    <menu>
      <icon name="grid" />
      <icon name="opacity" class="selected" />
      <icon name="color" />
      <svg viewBox="0 0 120 120">
        <linearGradient id="r">
          <stop offset="0" stop-color="red" />
          <stop offset="0.2857" stop-color="#ff0" />
          <stop offset="0.4286" stop-color="#0f0" />
          <stop offset="0.5714" stop-color="cyan" />
          <stop offset="0.7142" stop-color="blue" />
          <stop offset="0.8571" stop-color="#f0f" />
          <stop offset="1" stop-color="red" />
        </linearGradient>
        <circle cy="60" cx="60" r="60" fill="url(#r)" fill-opacity="0.66" />
      </svg>
      <icon name="animation" />
    </menu>
    <aside>
      <p><kbd>ctrl+</kbd></p>
    </aside>
  </section>
</template>

<script>
  import { Poster } from '@/persistance/Storage'
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
    computed: {
      keymap () {
        return {
          enter: this.save,
          esc: this.back,
          f: this.go_big
        }
      }
    },
    methods: {
      back () {
        let me = localStorage.me
        me = me.substring(2)
        const path = `/posters#${me}-posters-${this.$route.params.id}`
        const route = { path }
        this.$router.push(route)
      },
      async save () {
        const poster = new Poster(this.itemid)
        await poster.save()
        this.back()
      }
    }
  }
</script>
<style lang="stylus">
  section#editor
    &:fullscreen
    &:full-screen
      & > header
      & > menu
        visibility: hidden
    & > header > h4
      margin: 0
      color: red
      position: relative
      z-index: 2
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
      fill: green
      &:hover
        fill: red
        border-color: red
      &.remove
      &.opacity
      &.fullscreen
      &.finished
        fill-opacity: inherit
    & > header > h1
      color: green
    & > menu
      position: fixed
      z-index: 2
      bottom: base-line
      left: base-line
      right: base-line
      display: flex
      justify-content: space-between
      & > svg
        position: relative;
        z-index: 2
        &.selected
          stroke: red
          fill red
        &.grid
          border: 1px solid green
          border-radius: base-line * 0.15
          transition: border-color
          &:hover
            transition: border-color
            fill: green
            border-color: red

</style>

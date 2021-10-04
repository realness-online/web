<template lang="html">
  <section id="opacity" v-hotkey="keymap" class="page">
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
    <as-svg :itemid="itemid" :immediate="true"
            :tabindex="-1" :slice="false" :tabable="true" />
    <fieldset>
      <input v-model="color" :tabindex="-1" type="color">
      <as-svg :tabindex="-1" :itemid="itemid" class="as-line-art" />
    </fieldset>
    <footer>
      <menu>
        <icon name="grid" />
        <svg class="color selected" viewBox="0 0 120 120">
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
          <icon name="opacity" />
        </svg>
        <icon name="animation" />
      </menu>
    </footer>
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
        itemid: `${localStorage.me}/posters/${this.$route.params.id}`,
        color: '#000'
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
    watch: {
      color () {
        const type = 'fill'
        if (!document.activeElement) return
        console.log(document.activeElement)
        let fragment = document.activeElement.getAttribute('href')
        console.log(fragment)
        fragment = fragment.substring(1)
        const symbols = this.$el.querySelectorAll('symbol')
        symbols.forEach(symbol => {
          const id = symbol.getAttribute('id')
          if (id === fragment) {
            const path = symbol.querySelector('path')
            // const color = path.getAttribute(type)
            path.setAttribute(type, this.color)
            this.$emit(`change-${type}`)
          }
        })
      }
    },
    methods: {
      back () {
        let me = localStorage.me
        me = me.substring(2)
        const path = `/posters#${me}-posters-${this.$route.params.id}`
        const route = { path }
        this.$router.replace(route)
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
  section#opacity
    &:fullscreen
    &:full-screen
      & > header > a.fullscreen
        visibility: hidden
    & > header
      position: fixed;
      top: env(safe-area-inset-top)
      left: env(safe-area-inset-left)
      right: env(safe-area-inset-left)
    & > header
      & > a
        position: sticky
        z-index: 2
        height: base-line
      & > h4
        margin: 0
        color: red
        position: relative
        z-index: 2
        text-shadow: 1px 1px 1px background-black
    & > svg
      position: fixed
      z-index: 1
      top: 0
      bottom: 0
      left: 0
      right: 0
    & > fieldset
      width: 100%
      z-index: 4
      position: fixed
      bottom: base-line * 2
      right: 0
      border:none
      padding: 0
      height:auto
      padding: base-line
      display: flex
      // flex-direction: column
      justify-content: space-between
    & > fieldset > input
      width: base-line * 2
      height: base-line * 2
    & > fieldset > svg
      width: base-line * 2
      height: base-line * 2
      fill: transparent
      border: black
      border-radius:2rem
      min-height: auto
      stroke-width: base-line
      stroke-opacity: 1
      stroke:white
    & > header > a  > svg
    & > footer > menu > svg
      cursor: pointer
      fill: green
      .selected
        fill:red
      &:hover
        fill: red
      &.color > svg.opacity
        fill: background-black
        &:hover
          fill:transparent
      &.remove
      &.fullscreen
      &.finished
        fill-opacity: inherit
    & > footer > menu
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

<template>
  <section id="editor" class="page">
    <header>
      <h1>{{ page_title }}</h1>
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <icon name="nothing" />
      <a @click="back"><icon name="remove" /></a>
      <a @click="save"><icon name="finished" /></a>
    </header>
    <as-fill v-if="fill" :itemid="itemid" />
    <as-stroke v-if="stroke" :itemid="itemid" />
    <as-animation v-if="animation" :itemid="itemid" />
    <as-grid v-if="grid" :itemid="itemid" />
    <footer>
      <menu style="visibility: hidden">
        <icon :class="{ selected: color }" name="edit-color" />
        <icon :class="{ selected: animation }" name="animation" />
        <icon :class="{ selected: grid }" name="grid" />
      </menu>
    </footer>
  </section>
</template>
<script>
  import { Poster } from '@/persistance/Storage'
  import icon from '@/components/icon'
  import as_fill_figure from '@/components/posters/as-fill-figure'
  import as_stroke_figure from '@/components/posters/as-stroke-figure'
  import as_grid from '@/components/posters/as-grid'
  import as_animation from '@/components/posters/as-animation'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { useKeypress as use_keypress } from 'vue3-keypress'
  import { useFullscreen as use_fullscreen } from '@vueuse/core'
  import { ref } from 'vue'

  export default {
    components: {
      icon,
      'as-fill': as_fill_figure,
      'as-stroke': as_stroke_figure,
      'as-grid': as_grid,
      'as-animation': as_animation
    },
    setup() {
      const route = use_route()
      const router = use_router()
      const itemid = `${localStorage.me}/posters/${route.params.id}`
      const is_active = ref('true')
      const back = () => {
        console.log('back')
        const me = localStorage.me.substring(2)
        router.replace({
          path: `/posters#${me}-posters-${route.params.id}`
        })
      }
      const save = async () => {
        console.log('save')
        const poster = new Poster(itemid)
        await poster.save()
        back()
      }
      const { toggle } = use_fullscreen()
      use_keypress({
        keyEvent: 'keydown',
        isActive: is_active,
        keyBinds: [
          { keyCode: 'f', success: toggle },
          { keyCode: 'enter', success: save },
          { keyCode: 'esc', success: back }
        ]
      })
      return {
        back,
        save,
        itemid
      }
    },
    data() {
      return {
        fill: true,
        stroke: false,
        animation: false,
        grid: false
      }
    },
    computed: {
      page_title() {
        if (this.stroke) return 'Stroke'
        if (this.fill) return 'Fill'
        if (this.animation) return 'Animation'
        return 'Grid'
      },
      color() {
        if (this.stroke || this.fill) return true
        else return false
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
    & > header
      align-items: center
      background: transparent-black
      border-radius: 1rem
      z-index: 2
      position: fixed;
      padding: 0
      top: inset(top, base-line)
      left: inset(left, base-line)
      right: inset(right, base-line)
      & > h1
        margin: 0
        color: red
        position: relative
        z-index: 2
        text-shadow: 1px 1px 1px background-black
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
      background-color: transparent-black
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

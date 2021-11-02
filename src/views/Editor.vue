<template>
  <section id="editor" class="page">
    <header v-if="!is_fullscreen">
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
  export default {
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
<script setup>
  import icon from '@/components/icon'
  import asFill from '@/components/posters/as-fill-figure'
  import asStroke from '@/components/posters/as-stroke-figure'
  import asAnimation from '@/components/posters/as-animation'
  import asGrid from '@/components/posters/as-grid'

  import { Poster } from '@/persistance/Storage'
  import { useFullscreen, useMagicKeys } from '@vueuse/core'
  import { useRoute, useRouter } from 'vue-router'
  import { watch } from 'vue'

  const route = useRoute()
  const router = useRouter()
  const itemid = `${localStorage.me}/posters/${route.params.id}`
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
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = useFullscreen()
  const { f, enter, escape } = useMagicKeys()

  watch(enter, v => {
    if (v) save()
  })
  watch(escape, v => {
    if (v) back()
  })
  watch(f, v => {
    if (v) fullscreen()
  })
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

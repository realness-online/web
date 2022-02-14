<script setup>
  import icon from '@/components/icon'
  import asFill from '@/components/posters/as-figure-fill'
  import asAnimation from '@/components/posters/as-animation'
  import asGrid from '@/components/posters/as-grid'

  import { Poster } from '@/persistance/Storage'
  import { useFullscreen, useMagicKeys } from '@vueuse/core'
  import { useRoute, useRouter } from 'vue-router'
  import { watch, computed, ref } from 'vue'

  const fill = ref(true)
  const stroke = ref(false)
  const animation = ref(false)
  const grid = ref(false)
  const route = useRoute()
  const router = useRouter()
  const itemid = `${localStorage.me}/${route.params.type}/${route.params.id}`

  const page_title = computed(() => {
    if (stroke.value) return 'Stroke'
    if (fill.value) return 'Fill'
    if (animation.value) return 'Animation'
    return 'Grid'
  })
  const color = computed(() => {
    if (stroke.value || fill.value) return true
    else return false
  })
  const back = () => {
    console.log('back')
    const me = localStorage.me.substring(2)
    const id = route.params.id
    const type = route.params.type
    router.replace({ path: '/posters', hash: `#${me}-${type}-${id}` })
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
    <as-animation v-if="animation" :itemid="itemid" />
    <as-grid v-if="grid" :itemid="itemid" />
    <footer>
      <menu>
        <icon :class="{ selected: color }" name="edit-color" />
        <icon :class="{ selected: animation }" name="animation" />
        <icon :class="{ selected: grid }" name="grid" />
      </menu>
    </footer>
  </section>
</template>
<style lang="stylus">
  section#editor
    &:fullscreen
    &:full-screen
      & > header > a.fullscreen
        visibility: hidden
    & > header
      align-items: center
      z-index: 2
      position: fixed;
      top: inset(top, base-line)
      left: inset(left)
      right: inset(right)
      padding: 0
      @media (min-width: pad-begins)
        border-radius: 1rem
        background: black-transparent
        padding: 0 (base-line * 0.5)
      & > h1
        margin: 0
        color: red
        position: relative
        z-index: 2
        text-shadow: 1px 1px 1px black-background
    & > header > a  > svg
    & > footer > menu > svg
      cursor: pointer
      fill: green
      .selected
        fill:red
      &:hover
        fill: red
      &.color > svg.opacity
        fill: black-background
        &:hover
          fill:transparent
      &.remove
      &.fullscreen
      &.finished
        fill-opacity: inherit
    & > footer > menu
      background-color: black-transparent
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

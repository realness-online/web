<template>
  <section id="editor" class="page">
    <header v-if="!is_fullscreen">
      <h1>{{ page_title }}</h1>
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <a @click="back"><icon name="remove" /></a>
      <a @click="save"><icon name="finished" /></a>
    </header>
    <as-fill v-if="fill || stroke" :itemid="itemid" @toggle="toggle_stroke" />
    <as-grid v-if="grid" :itemid="itemid" />
    <as-animation v-if="animation" :itemid="itemid" />
    <footer>
      <menu hidden>
        <icon :class="{ selected: color }" name="edit-color" />
        <icon :class="{ selected: grid }" name="grid" />
        <icon :class="{ selected: animation }" name="animation" />
      </menu>
    </footer>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import asFill from '@/components/posters/as-figure-fill'
  import asAnimation from '@/components/posters/as-animation'
  import asGrid from '@/components/posters/as-grid'

  import { Poster } from '@/persistance/Storage'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_Keyboard
  } from '@vueuse/core'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { watch, computed, ref, provide } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  const fill = ref(true)
  const stroke = ref(false)
  const animation = ref(false)
  const grid = ref(false)
  const route = use_route()
  const router = use_router()
  const itemid = `${localStorage.me}/${route.params.type}/${route.params.id}`
  const page_title = computed(() => {
    if (stroke.value) return 'Stroke'
    if (fill.value) return 'Fill'
    if (animation.value) return 'Animation'
    return 'Grid'
  })
  const toggle_stroke = () => {
    stroke.value = !stroke.value
    fill.value = !fill.value
  }
  const color = computed(() => {
    if (stroke.value || fill.value) return true
    else return false
  })
  const back = () => {
    const me = localStorage.me.substring(2)
    const id = route.params.id
    const type = route.params.type
    new_gradients.value = null
    if (new_vector.value) {
      new_vector.value = null
      router.push({ path: '/posters' })
    } else {
      router.push({ path: '/posters', hash: `#${me}-${type}-${id}` })
    }
  }
  const save = async () => {
    const poster = new Poster(itemid)
    await poster.save()
    if (new_vector.value) new_vector.value = null
    if (new_gradients.value) new_gradients.value = null
    back()
  }
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen()
  const { f, enter, escape } = use_Keyboard()

  const { new_vector, new_gradients } = use_vectorize()
  if (new_vector.value) provide('new-poster', true)

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
    & > header
      align-items: center
      z-index: 2
      position: fixed;
      top: inset(top, 0)
      left: 0
      right: 0
      padding: base-line
      @media (min-width: pad-begins)
        padding: 0 base-line
      background: black-transparent
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
      padding: base-line
      bottom: 0
      left: 0
      right: 0
      display: flex
      justify-content: space-between
      & > svg
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

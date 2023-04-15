<template>
  <section id="editor" class="page">
    <header v-if="menu" ref="header">
      <h1 @click="hide_menu">{{ page_title }}</h1>
      <a @click="back"><icon name="remove" /></a>
      <as-download :itemid="itemid" />
      <a @click="save"><icon name="finished" /></a>
    </header>
    <as-fill v-if="fill || stroke" :itemid="itemid" @toggle="toggle_stroke" />
    <as-grid v-if="grid" :itemid="itemid" />
    <as-animation v-if="animation" :itemid="itemid" />
    <footer v-if="!is_fullscreen || !menu" hidden>
      <menu>
        <icon :class="{ selected: color }" name="edit-color" />
        <icon :class="{ selected: grid }" name="grid" />
        <icon :class="{ selected: animation }" name="animation" />
      </menu>
    </footer>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsFill from '@/components/posters/as-figure-fill'
  import AsAnimation from '@/components/posters/as-animation'
  import AsGrid from '@/components/posters/as-grid'
  import asDownload from '@/components/download-vector'
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
  const menu = ref(true)
  const route = use_route()
  const router = use_router()
  const itemid = `${localStorage.me}/posters/${route.params.id}`
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
    new_gradients.value = null
    if (new_vector.value) {
      new_vector.value = null
      router.replace({ path: '/posters' })
    } else {
      router.replace({ path: '/posters', hash: `#${me}-posters-${id}` })
    }
  }
  const save = async () => {
    await new Poster(itemid).save()
    if (new_vector.value) new_vector.value = null
    if (new_gradients.value) new_gradients.value = null
    back()
  }
  const just_poster = () => {
    if (fullscreen_supported.value) fullscreen()
    else menu.value = false
  }
  const hide_menu = () => {
    console.log('hide menu')
    menu.value = false
  }
  const {
    toggle: fullscreen,
    isFullscreen: is_fullscreen,
    isSupported: fullscreen_supported
  } = use_fullscreen()
  const { f, enter, escape } = use_Keyboard()

  const { new_vector, new_gradients } = use_vectorize()
  if (new_vector.value) provide('new-poster', true)

  watch(enter, v => {
    if (v) save()
  })
  watch(escape, v => {
    if (v) back()
  })
  watch(is_fullscreen, v => {
    if (!v) return
    if (!is_fullscreen.value) menu.value = true
  })
  watch(f, v => {
    if (!v) return
    just_poster()
  })
</script>
<style lang="stylus">
  section#editor
    & > header
      align-items: center
      z-index: 2
      position: absolute
      top: inset(0)
      left: 0
      right: 0
      padding: base-line
      background: black-transparent
      @media (min-width: pad-begins)
        padding: (base-line * 2) base-line base-line base-line
      & > h1
        cursor: pointer
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

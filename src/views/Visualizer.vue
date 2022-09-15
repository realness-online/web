<template>
  <section id="visualizer" class="page">
    <header v-if="!is_fullscreen">
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <a @click="back"><icon name="remove" /></a>
    </header>
    <as-svg
      :itemid="itemid"
      :slice="false"
      :tabable="true"
      tabindex="-1"
      @focus="layer_selected" />
    <footer>
      <menu>
        <button v-if="can_visualize && !analyzing" @click="start">
          Visualize
        </button>
        <button v-if="analyzing" @click="stop">Stop</button>
      </menu>
    </footer>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsSvg from '@/components/posters/as-svg'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_Keyboard
  } from '@vueuse/core'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { watch, computed, ref, provide } from 'vue'

  const route = use_route()
  const router = use_router()
  const itemid = `${localStorage.me}/${route.params.type}/${route.params.id}`
  const analyser = ref(null)
  const analyzing = ref(false)
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen()
  const { f, enter, escape } = use_Keyboard()
  const can_visualize = () => {
    console.log(!navigator.mediaDevices)
    navigator.mediaDevices
  }
  const start = async () => {
    const context = new AudioContext()
    analyser.value = context.createAnalyser()
    analyser.value.fftSize = 32
    analyser.value.minDecibels = -64
    analyser.value.maxDecibels = -6
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { height: 512 }
    })
    const input = context.createMediaStreamSource(stream)
    input.connect(analyser.value)
    analyzing.value = true
    requestAnimationFrame(visualize)
  }
  const stop = () => (analyzing.value = false)
  const visualize = () => {
    const times = new Uint8Array(analyser.value.frequencyBinCount)
    analyser.value.getByteTimeDomainData(times)
    console.log(times.length)
    for (var i = 0; i < times.length; i++) {
      const value = times[i]
      const zerod = value - 128
      console.log(i, value, zerod)
    }
    if (analyzing.value) requestAnimationFrame(visualize)
  }
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
  const layer_selected = layer => {
    console.log(layer)
  }
  watch(enter, v => {
    if (v) back()
  })
  watch(escape, v => {
    if (v) back()
  })
  watch(f, v => {
    if (v) fullscreen()
  })
</script>
<style lang="stylus">
  section#visualizer
    & > header
      align-items: center
      z-index: 2
      position: fixed;
      top: inset(top, 0)
      left: 0
      right: 0
      padding: base-line
      background: black-transparent
      @media (min-width: pad-begins)
        padding: (base-line * 0.25) base-line
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

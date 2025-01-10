<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  // import AsSvg from '@/components/posters/as-svg'
  import { use as use_audio_analyzer } from '@/use/audio'
  import { use as use_machine_learning } from '@/use/machine-learning'
  import { useFullscreen as use_fullscreen } from '@vueuse/core'
  import { ref, computed, onMounted as mounted } from 'vue'

  // const { f, enter, escape } = use_Keyboard()
  const facing = ref('user')
  mounted(async () => {
    console.log('views:/camera', navigator.mediaDevices.getSupportedConstraints())
    await start()
  })
  const config = computed(() => ({
    audio: true,
    video: {
      facingMode: facing.value,
      height: 513,
      width: 912
    }
  }))
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen()
  const { analyze_audio } = use_audio_analyzer()
  const { video, canvas, predict } = use_machine_learning()

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia(config.value)
    video.value.srcObject = stream
    await video.value.play()
    analyze_audio(stream)
  }
  // const stop = async () => {
  //   analyzing.value = false
  //   await video.value.pause()
  // }
  const toggle_camera = async () => {
    if (facing.value == 'user') facing.value = 'environment'
    else facing.value = 'user'
    const stream = await navigator.mediaDevices.getUserMedia(config.value)
    video.value.srcObject = stream
    analyze_audio(stream)
  }
</script>

<template>
  <section id="visualizer" class="page" outline>
    <header v-if="!is_fullscreen">
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <logo-as-link />
    </header>
    <h1>Camera</h1>
    <video
      ref="video"
      hidden
      autoplay
      controls
      muted
      playsinline
      @click="toggle_camera" />
    <canvas
      ref="canvas"
      :width="config.video.width"
      :height="config.video.height"></canvas>
    <footer>
      <menu>
        <button @click="predict">predict</button>
      </menu>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#visualizer
    & > h1
      color: red
    // & > video
    & > canvas
      margin: 0 auto 1rem auto
      display:flex
      max-width: calc(100vw - 3rem)
      max-height: 50vh
      opacity: 0.75
      border-radius: base-line
      &:focus
        outline:4px solid red
    & > header > a  > svg
    & > footer > menu > svg
      cursor: pointer
      fill: red
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

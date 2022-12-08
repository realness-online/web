<template>
  <section id="visualizer" class="page">
    <header v-if="!is_fullscreen">
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <logo-as-link />
    </header>
    <h1>Camera</h1>
    <canvas ref="canvas"  hidden />
    <video ref="video" autoplay controls muted playsinline  @click="toggle_camera" />
    <footer>
      <menu>

      </menu>
    </footer>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  // import AsSvg from '@/components/posters/as-svg'
  import { use as use_audio_analyzer } from '@/use/audio'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_Keyboard
  } from '@vueuse/core'
  import { watch, ref, computed, onMounted as mounted } from 'vue'

  // const { f, enter, escape } = use_Keyboard()
  const video = ref()
  const canvas = ref()
  const facing = ref('user')
  const coco_model = ref(null)
  const depth_model = ref(null)
  mounted(async () => {
    console.log('views:/camera',navigator.mediaDevices.getSupportedConstraints());
    await start()
    coco_model.value = await cocoSsd.load()
  })
  const video_config = computed(() => {
    return {
      audio: true,
      video: {
        facingMode: facing.value,
        height:513,
        width:912
      }
    }
  })
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen()
  const { analyzing, analyze_audio } = use_audio_analyzer()
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia(video_config.value)
    video.value.srcObject = stream
    await video.value.play()
    analyze_audio(stream)
  }
  const stop = async () => {
    analyzing.value = false
    await video.value.pause()
  }
  const toggle_camera = async ()=> {
    if (facing.value == "user") facing.value = "environment";
    else facing.value = "user";
    const stream = await navigator.mediaDevices.getUserMedia(video_config.value)
    video.value.srcObject = stream
    analyze_audio(stream)    
  }

  // function takeASnap() {
  //   const canvas = document.createElement('canvas') // create a canvas
  //   const ctx = canvas.getContext('2d') // get its context
  //   canvas.width = vid.videoWidth // set its size to the one of the video
  //   canvas.height = vid.videoHeight
  //   ctx.drawImage(vid, 0, 0) // the video
  //   return new Promise((res, rej) => {
  //     canvas.toBlob(res, 'image/jpeg') // request a Blob from the canvas
  //   })
  // }
  // function download(blob) {
  //   // uses the <a download> to download a Blob
  //   let a = document.createElement('a')
  //   a.href = URL.createObjectURL(blob)
  //   a.download = 'screenshot.jpg'
  //   document.body.appendChild(a)
  //   a.click()
  // }
</script>
<style lang="stylus">
  section#visualizer
    & > h1
      color: red
    & > video 
      margin: 0 auto
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

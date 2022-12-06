<template>
  <section id="visualizer" class="page" outline>
    <header v-if="!is_fullscreen">
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <a @click="back"><icon name="remove" /></a>
    </header>
    <h1>Camera</h1>
    <canvas ref="canvas" />
    <video ref="video" />
    <as-svg
      :itemid="itemid"
      @focus="layer_selected" />
    <footer>
      <menu>
        <button v-if="can_visualize && !analyzing" @click="start">Visualize</button>
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
    useMagicKeys as use_Keyboard,
  } from '@vueuse/core'
  import { useRoute as use_route } from 'vue-router'
  import { watch, computed, ref, onMounted as mounted } from 'vue'

  const route = use_route()
  const itemid = `${localStorage.me}/posters/${route.params.id}`
  const analyser = ref(null)
  const analyzing = ref(false)
  const video = ref()
  const canvas = ref()
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
    const stream = await navigator. mediaDevices.getUserMedia({
      audio: true,
      video: { height: 512 },
    })
    console.log('stream', stream)
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
  mounted(async () => {
    console.log("video", video.value)
    console.log("canvas", canvas.value)
    console.info('views:/camera')
  })

  // const stream = await navigator.mediaDevices.getUserMedia({
  //   video: { height: 512 }
  // })
  // vid.srcObject = stream // don't use createObjectURL(MediaStream)
  // await vid.play()
  // const btn = document.querySelector('button')

  // btn.disabled = false
  // btn.onclick = e => {
  //   takeASnap().then(download)
  // }

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
      // background-color: black-transparent
      // position: fixed
      padding: base-line
      // bottom: 0
      // left: 0
      // right: 0
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

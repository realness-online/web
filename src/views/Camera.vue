<template>
  <section id="visualizer" class="page" outline>
    <header v-if="!is_fullscreen">
      <a class="fullscreen" @click="fullscreen"><icon name="fullscreen" /></a>
      <a @click="back"><icon name="remove" /></a>
    </header>
    <h1>Camera</h1>
    <canvas ref="canvas"  hidden />
    <video ref="video" autoplay controls muted playsinline  @click="toggle_camera" />
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
  // import AsSvg from '@/components/posters/as-svg'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_Keyboard
  } from '@vueuse/core'
  import { watch, ref, computed, onMounted as mounted } from 'vue'
  const analyser = ref(null)
  const analyzing = ref(false)
  const video = ref()
  const canvas = ref()
  const facing = ref('user')
  mounted(async () => {
    console.log("configurable options",navigator.mediaDevices.getSupportedConstraints());
    console.info('views:/camera')
    await start()
  })
  const video_config = computed(() => {
    return {
      audio: true,
      video: { facingMode: facing.value, height:512}
    }
  })
  const { toggle: fullscreen, isFullscreen: is_fullscreen } = use_fullscreen()
  // const { f, enter, escape } = use_Keyboard()
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
  const analyze_audio = (stream) => {
    const context = new AudioContext()
    analyser.value = context.createAnalyser()
    analyser.value.fftSize = 32
    analyser.value.minDecibels = -64
    analyser.value.maxDecibels = -6
    const input = context.createMediaStreamSource(stream)
    input.connect(analyser.value)
    analyzing.value = true
    requestAnimationFrame(process_audio)
  }
  const process_audio = () => {
    const times = new Uint8Array(analyser.value.frequencyBinCount)
    analyser.value.getByteTimeDomainData(times)
    // for (var i = 0; i < times.length; i++) {
    //   const value = times[i]
    //   const zerod = value - 128
    //   console.log(i, value, zerod)
    // }
    if (analyzing.value) requestAnimationFrame(process_audio)
  }
  // const stream = await navigator.mediaDevices.getUserMedia({
  //   video: { height: 512 }
  // })

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
    & > video  
      max-width:100vw
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

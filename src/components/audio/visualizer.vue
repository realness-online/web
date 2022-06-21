<template>
  <button v-if="can_visualize && !analyzing" @click="start">
    Visualize
  </button>
  <button v-if="analyzing" @click="stop">Stop</button>
</template>
<script setup>
  import { ref } from 'vue'
  const analyser = ref(null)
  const analyzing = ref(false)
  const can_visualize = () => navigator.mediaDevices

  const start = async () => {
    const context = new AudioContext()
    analyser.value = context.createAnalyser()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const input = context.createMediaStreamSource(stream)
    input.connect(analyser.value)
    analyzing.value = true
    requestAnimationFrame(visualize)
  }

  const stop = () => analyzing.value = false
  const visualize = () => {
    const times = new Uint8Array(analyser.value.frequencyBinCount)
    analyser.value.getByteTimeDomainData(times)
    console.log(times.length)
    for (var i = 0; i < times.length; i++) {
      const value = times[i]
      const percent = value / 256
      console.log(value, percent)
    }
    if (analyzing.value) requestAnimationFrame(visualize)
  }
</script>

<style lang="stylus"></style>

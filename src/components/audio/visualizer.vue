<template>
  <button v-if="can_visualize" @click="listen_to_the_beats">Visualize</button>
</template>
<script setup>
  import { onMounted as mounted } from 'vue'
  const can_visualize = () => navigator.mediaDevices
  const listen_to_the_beats = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audio_context = new AudioContext()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
    console.log(stream.getAudioTracks())
    const analyser = audio_context.createAnalyser()
    const source = audio_context.createMediaStreamSource(stream)
    source.connect(analyser)
    console.log(source, analyser)
  }
</script>
<style lang="stylus"></style>

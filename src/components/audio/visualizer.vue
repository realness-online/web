<template></template>
<script setup>
  if (navigator.mediaDevices) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audio_context = new AudioContext()
    const stream = await navigator.mediaDevices.getUserMedia ({audio: true, video: false})
    console.log(stream.getAudioTracks().stop());
    let analyser = audio_context.createAnalyser()
    source = audio_context.createMediaStreamSource(stream)
    source.connect(analyser)
  }

</script>
<style lang="stylus"></style>

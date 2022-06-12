<template>
  <button v-if="can_visualize && !audio_playing" @click="start">
    Visualize
  </button>
  <button v-if="audio_playing" @click="stop">Stop</button>
</template>
<script setup>
  const can_visualize = () => navigator.mediaDevices
  let audio_context
  let source_node
  let analyser_node
  let javascript_node
  // let audio_data = null
  let audio_playing = false
  let sample_size = 1024 // number of samples to collect before analyzing data
  let amplitude_array // array to hold time domain data

  const setup_audio = async () => {
    const audio_context = new AudioContext()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
    const analyser = audio_context.createAnalyser()
    const source = audio_context.createMediaStreamSource(stream)
    source.connect(analyser)
    console.log(source, analyser)

    source_node = audio_context.createBufferSource()
    analyser_node = audio_context.createAnalyser()
    javascript_node = audio_context.createScriptProcessor(sample_size, 1, 1)
    // Create the array for the data values
    amplitude_array = new Uint8Array(analyser_node.frequencyBinCount)
    // Now connect the nodes together
    source_node.connect(audio_context.destination)
    source_node.connect(analyser_node)
    analyser_node.connect(javascript_node)
    javascript_node.connect(audio_context.destination)
  }
  const draw_time_domain = () => {
    // console.log(draw_time_domain)
    // for (let i = 0; i < amplitude_array.length; i++) {
    //   let value = amplitude_array[i] / 256
    //   // let y = canvasHeight - canvasHeight * value - 1
    //   // this is where you tweak the svg params
    //   // canvas.fillStyle = '#ffffff'
    //   // canvas.fillRect(i, y, 1, 1)
    // }
  }
  const start = async () => {
    if (!audio_context) audio_context = new AudioContext()
    await setup_audio()

    audio_playing = true
    console.log('audio_playing', audio_playing)
    javascript_node.onaudioprocess = () => {
      analyser_node.getByteTimeDomainData(amplitude_array)
      if (audio_playing === true) requestAnimationFrame(draw_time_domain)
    }
  }
  const stop = () => {
    source_node.stop(0)
    audio_playing = false
  }
</script>
<style lang="stylus"></style>

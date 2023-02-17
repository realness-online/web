import { ref } from 'vue'
export const use = () => {
  const analyser = ref(null)
  const analyzing = ref(false)

  const analyze_audio = stream => {
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

  return {
    analyzing,
    analyze_audio
  }
}

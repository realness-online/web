import { ref } from 'vue'

/**
 * @typedef {Object} AudioAnalyzer
 * @property {boolean} analyzing - Whether audio analysis is currently active
 * @property {(stream: MediaStream) => void} analyze_audio - Start analyzing audio from stream
 */

/**
 * Audio analysis composable
 * @returns {AudioAnalyzer}
 */
export const use = () => {
  /** @type {import('vue').Ref<AnalyserNode|null>} */
  const analyser = ref(null)

  /** @type {import('vue').Ref<boolean>} */
  const analyzing = ref(false)

  /**
   * Processes audio data on each animation frame
   */
  const process_audio = () => {
    const times = new Uint8Array(analyser.value.frequencyBinCount)
    analyser.value?.getByteTimeDomainData(times)
    // for (var i = 0; i < times.length; i++) {
    //   const value = times[i]
    //   const zerod = value - 128
    //   console.log(i, value, zerod)
    // }
    if (analyzing.value) requestAnimationFrame(process_audio)
  }

  /**
   * Initializes audio analysis for a media stream
   * @param {MediaStream} stream - The audio stream to analyze
   */
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

  return {
    analyzing,
    analyze_audio
  }
}

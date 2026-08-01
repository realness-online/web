/** @fileoverview Decode dropped/picked audio files into AudioBuffers for muxing. */

/** Audio MIME types the WebCodecs/AudioContext pipeline can decode to an AudioBuffer. */
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-flac'
])

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm|mp4)$/i

/**
 * Whether a file is audio we can decode into a soundtrack. Matches by MIME
 * type first, then falls back to the file extension for types browsers report
 * loosely (e.g. some OSes give audio/mpeg different labels).
 * @param {File} file - A dropped or picked file
 * @returns {boolean}
 */
export const is_audio_file = file => {
  if (!file) return false
  if (AUDIO_TYPES.has(file.type)) return true
  if (file.type.startsWith('audio/') && file.type !== 'audio/midi') return true
  return AUDIO_EXTENSIONS.test(file.name || '')
}

/**
 * Shared AudioContext, created lazily and reused across decodes. Kept module
 * scope so it is created once per app load rather than per export.
 * @type {AudioContext|null}
 */
let audio_context = null
const get_audio_context = () => {
  if (!audio_context) audio_context = new AudioContext()
  return audio_context
}

/**
 * Decodes one audio File into an AudioBuffer.
 * @param {File} file - Audio file (mp3/wav/ogg/m4a/flac/...)
 * @returns {Promise<AudioBuffer>}
 */
export const decode_audio_file = async file => {
  const array_buffer = await file.arrayBuffer()
  return get_audio_context().decodeAudioData(array_buffer)
}

/**
 * Decodes a list of audio Files. Skips non-audio files; throws if none decode.
 * @param {File[]} files - Files, only audio ones are decoded
 * @returns {Promise<AudioBuffer[]>}
 */
export const decode_audio_files = async files => {
  const audio_files = files.filter(is_audio_file)
  const decoded = await Promise.all(audio_files.map(decode_audio_file))
  return decoded.filter(Boolean)
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { is_audio_file } from '@/utils/audio-file'

// decode_* caches an AudioContext at module scope, so each test needs a fresh
// module to re-assert the (re-mocked) constructor.
const load_decoders = async () => {
  vi.resetModules()
  return import('@/utils/audio-file')
}

describe('is_audio_file', () => {
  it('accepts files by MIME type', () => {
    expect(is_audio_file({ type: 'audio/mpeg', name: 'x.mp3' })).toBe(true)
    expect(is_audio_file({ type: 'audio/wav', name: 'x.wav' })).toBe(true)
    expect(is_audio_file({ type: 'audio/ogg', name: 'x.ogg' })).toBe(true)
  })

  it('accepts audio files by extension when MIME is loose', () => {
    expect(is_audio_file({ type: '', name: 'track.m4a' })).toBe(true)
    expect(
      is_audio_file({ type: 'application/octet-stream', name: 'clip.mp3' })
    ).toBe(true)
    expect(is_audio_file({ type: 'audio/mpeg', name: 'no-ext' })).toBe(true)
  })

  it('rejects non-audio and falls back to extension', () => {
    expect(is_audio_file({ type: 'image/png', name: 'poster.png' })).toBe(false)
    expect(is_audio_file({ type: 'audio/midi', name: 'song.midi' })).toBe(false)
    expect(is_audio_file(null)).toBe(false)
  })
})

describe('decode_audio_file', () => {
  let original_context
  let mock_decode

  beforeEach(() => {
    original_context = globalThis.AudioContext
    mock_decode = vi.fn(async () => ({ duration: 1 }))
    globalThis.AudioContext = class {
      decodeAudioData = mock_decode
    }
  })

  afterEach(() => {
    globalThis.AudioContext = original_context
  })

  it('reads the file buffer and decodes it through the AudioContext', async () => {
    const { decode_audio_files } = await load_decoders()
    const file = {
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      type: 'audio/mpeg',
      name: 'loop.mp3'
    }
    const decoded = await decode_audio_files([file])
    expect(file.arrayBuffer).toHaveBeenCalled()
    expect(mock_decode).toHaveBeenCalled()
    expect(decoded).toEqual([{ duration: 1 }])
  })

  it('decodes only the audio files in a mixed list', async () => {
    const { decode_audio_files } = await load_decoders()
    const audio_file = {
      type: 'audio/mpeg',
      name: 'a.mp3',
      arrayBuffer: vi.fn(async () => new ArrayBuffer(4))
    }
    const image_file = {
      type: 'image/png',
      name: 'p.png',
      arrayBuffer: vi.fn(async () => new ArrayBuffer(4))
    }
    const result = await decode_audio_files([image_file, audio_file])
    expect(result.length).toBe(1)
    expect(image_file.arrayBuffer).not.toHaveBeenCalled()
  })
})

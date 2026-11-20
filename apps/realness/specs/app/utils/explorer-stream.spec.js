import { describe, expect, it } from 'vite-plus/test'
import { stream_partials } from '@/utils/explorer'

const partial = content => ({
  kind: 'value',
  value: { docs: { 'pi.live': { generation: { message: { content } } } } }
})

const idle = { kind: 'value', value: { docs: { 'pi.live': {} } } }

const streamed = async calls => {
  const deltas = []
  const thoughts = []
  const listener = stream_partials(
    text => deltas.push(text),
    text => thoughts.push(text)
  )
  for (const call of calls) await listener(call)
  return { deltas, thoughts }
}

describe('stream_partials', () => {
  it('hands on only what each partial adds, text and thinking apart', async () => {
    expect(
      await streamed([
        partial([{ type: 'thinking', thinking: 'Check' }]),
        partial([
          { type: 'thinking', thinking: 'Check first.' },
          { type: 'text', text: 'You are' }
        ]),
        partial([
          { type: 'thinking', thinking: 'Check first.' },
          { type: 'text', text: 'You are in /realness.' }
        ])
      ])
    ).toEqual({
      deltas: ['You are', ' in /realness.'],
      thoughts: ['Check', ' first.']
    })
  })

  it('starts over for the next answer, and skips failed or idle calls', async () => {
    expect(
      await streamed([
        partial([{ type: 'text', text: 'Reading.' }]),
        idle,
        { kind: 'failed', error: new Error('lost') },
        partial([{ type: 'text', text: 'Read it.' }])
      ])
    ).toEqual({ deltas: ['Reading.', 'Read it.'], thoughts: [] })
  })
})

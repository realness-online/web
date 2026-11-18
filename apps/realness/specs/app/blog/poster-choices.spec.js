/**
 * p1: the poster panel offers the person's own posters, newest first.
 */
import { describe, expect, it, vi } from 'vite-plus/test'
import { CHOICE_LIMIT, poster_choices } from '@/blog/poster-choices'

const posters = count =>
  Array.from({ length: count }, (_, i) => ({ id: `/+1555/posters/${i + 1}` }))

const svg = id => ({ svg: { id, tagName: 'svg' } })

describe('@/blog/poster-choices', () => {
  it('offers a choice per poster, in the order given', async () => {
    const fake = vi.fn(async id => svg(id))
    const choices = await poster_choices(posters(3), fake)
    expect(choices.map(choice => choice.id)).toEqual([
      '/+1555/posters/1',
      '/+1555/posters/2',
      '/+1555/posters/3'
    ])
    expect(choices[0].svg).toEqual(svg('/+1555/posters/1').svg)
  })

  it('stops at a screenful of choices', async () => {
    const fake = vi.fn(async id => svg(id))
    const choices = await poster_choices(posters(CHOICE_LIMIT + 6), fake)
    expect(choices).toHaveLength(CHOICE_LIMIT)
    expect(fake).toHaveBeenCalledTimes(CHOICE_LIMIT)
  })

  it('leaves out a poster that cannot load', async () => {
    const fake = vi.fn(async id => {
      if (id.endsWith('/2')) throw new Error('gone')
      if (id.endsWith('/3')) return { svg: null }
      return svg(id)
    })
    const choices = await poster_choices(posters(3), fake)
    expect(choices.map(choice => choice.id)).toEqual(['/+1555/posters/1'])
  })

  it('offers nothing when the person has no posters', async () => {
    expect(await poster_choices([], vi.fn())).toEqual([])
  })
})

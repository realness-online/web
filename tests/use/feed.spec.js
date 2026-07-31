import { describe, it, expect, vi } from 'vite-plus/test'
import { ref, nextTick } from 'vue'
import { use_feed, authors_to_reload } from '@/use/feed'

const feed_with = () => {
  const posters = ref([])
  const statements = ref([])
  const statements_for_person = vi.fn().mockResolvedValue(undefined)
  const posters_for_person = vi.fn().mockResolvedValue(undefined)
  const refresh_signal = ref(null)
  const feed = use_feed({
    posters,
    statements,
    statements_for_person,
    posters_for_person,
    refresh_signal,
    set_working: undefined
  })
  return { feed, refresh_signal, statements_for_person, posters_for_person }
}

describe('authors_to_reload', () => {
  it('falls back to every loaded author without a list', () => {
    expect(authors_to_reload(undefined, ['/+1', '/+2'])).toEqual(['/+1', '/+2'])
    expect(authors_to_reload({ at: 1 }, ['/+1'])).toEqual(['/+1'])
    expect(authors_to_reload(Date.now(), ['/+1'])).toEqual(['/+1'])
  })

  it('keeps only the named authors this feed already shows', () => {
    expect(
      authors_to_reload({ authors: ['/+2', '/+9'] }, ['/+1', '/+2'])
    ).toEqual(['/+2'])
    expect(authors_to_reload({ authors: [] }, ['/+1'])).toEqual([])
  })
})

describe('use_feed', () => {
  it('reloads only the authors sync named', async () => {
    const { feed, refresh_signal, posters_for_person } = feed_with()
    await feed.load_feed_for_people(['/+1', '/+2'])
    posters_for_person.mockClear()

    refresh_signal.value = { at: Date.now(), authors: ['/+2'] }
    await nextTick()
    await Promise.resolve()

    expect(posters_for_person).toHaveBeenCalledTimes(1)
    expect(posters_for_person).toHaveBeenCalledWith({ id: '/+2' })
  })

  it('still shows everyone after reloading one of them', async () => {
    const { feed, refresh_signal, posters_for_person } = feed_with()
    await feed.load_feed_for_people(['/+1', '/+2'])

    refresh_signal.value = { at: Date.now(), authors: ['/+2'] }
    await nextTick()
    await Promise.resolve()
    posters_for_person.mockClear()

    // No author list: everyone the feed shows, which must still be both.
    refresh_signal.value = { at: Date.now() }
    await nextTick()
    await Promise.resolve()

    expect(posters_for_person).toHaveBeenCalledWith({ id: '/+1' })
    expect(posters_for_person).toHaveBeenCalledWith({ id: '/+2' })
  })

  it('forgets the previous roster on a reset', async () => {
    const { feed, refresh_signal, posters_for_person } = feed_with()
    await feed.load_feed_for_people(['/+1', '/+2'])
    await feed.load_feed_for_people(['/+3'], { reset: true })
    posters_for_person.mockClear()

    refresh_signal.value = { at: Date.now() }
    await nextTick()
    await Promise.resolve()

    expect(posters_for_person).toHaveBeenCalledTimes(1)
    expect(posters_for_person).toHaveBeenCalledWith({ id: '/+3' })
  })

  it('skips the reload when no shown author changed', async () => {
    const { feed, refresh_signal, posters_for_person } = feed_with()
    await feed.load_feed_for_people(['/+1'])
    posters_for_person.mockClear()

    refresh_signal.value = { at: Date.now(), authors: ['/+9'] }
    await nextTick()
    await Promise.resolve()

    expect(posters_for_person).not.toHaveBeenCalled()
  })

  it('runs on_refresh when refresh_signal changes instead of load_feed_for_people', async () => {
    const posters = ref([])
    const statements = ref([])
    const statements_for_person = vi.fn().mockResolvedValue(undefined)
    const posters_for_person = vi.fn().mockResolvedValue(undefined)
    const refresh_signal = ref(0)
    const on_refresh = vi.fn().mockResolvedValue(undefined)

    use_feed({
      posters,
      statements,
      statements_for_person,
      posters_for_person,
      refresh_signal,
      on_refresh,
      set_working: undefined
    })

    refresh_signal.value = Date.now()
    await nextTick()

    expect(on_refresh).toHaveBeenCalledTimes(1)
    expect(statements_for_person).not.toHaveBeenCalled()
    expect(posters_for_person).not.toHaveBeenCalled()
  })
})

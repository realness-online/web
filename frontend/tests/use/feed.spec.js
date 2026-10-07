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

/**
 * A statement rewritten under a poster kept showing its old text until the page
 * was reloaded: the pairing is cached by item id, an edit never changes an id,
 * and `update_statement` replaces the statement objects instead of mutating
 * them - so the cache served the pairing captured before the edit. Both halves
 * are pinned here: the cache has to clear on an edit, and it has to still be a
 * cache the rest of the time.
 */
describe('overlay pairing cache', () => {
  const poster = { id: '/+1/posters/2' }
  const thought_of = text => [{ id: '/+1/statements/1', statement: text }]
  const feed_for = statements =>
    use_feed({
      posters: ref([poster]),
      statements,
      statements_for_person: vi.fn().mockResolvedValue(undefined),
      posters_for_person: vi.fn().mockResolvedValue(undefined),
      set_working: undefined
    })

  it('re-pairs after a statement is rewritten', async () => {
    const statements = ref(thought_of('before'))
    const feed = feed_for(statements)
    const day = [poster, statements.value]
    expect(feed.overlay_statements_for_poster(day, poster)?.[0].statement).toBe(
      'before'
    )

    // update_statement replaces the objects rather than mutating them.
    statements.value = thought_of('after')
    await nextTick()

    const fresh_day = [poster, statements.value]
    expect(
      feed.overlay_statements_for_poster(fresh_day, poster)?.[0].statement
    ).toBe('after')
  })

  it('re-pairs when the statement is emptied, not just changed', async () => {
    const statements = ref(thought_of('written'))
    const feed = feed_for(statements)
    feed.overlay_statements_for_poster([poster, statements.value], poster)

    statements.value = thought_of('')
    await nextTick()

    expect(
      feed.overlay_statements_for_poster(
        [poster, statements.value],
        poster
      )?.[0].statement
    ).toBe('')
  })

  it('still caches while the statements hold still', () => {
    const statements = ref(thought_of('before'))
    const feed = feed_for(statements)
    const day = [poster, statements.value]
    const first = feed.overlay_statements_for_poster(day, poster)
    // A fresh array for the same day, as a re-render hands over.
    const same = feed.overlay_statements_for_poster(
      [poster, statements.value],
      poster
    )
    expect(same).toBe(first)
  })
})

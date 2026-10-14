import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { mount, flushPromises } from '@vue/test-utils'
import AsDays from '@/components/as-days.vue'

vi.mock('@/components/icon', () => ({
  default: { name: 'Icon', template: '<svg />' }
}))

vi.mock('@/utils/thoughts', () => ({
  thoughts_for_author: vi.fn(items => items),
  thought_feed_slots: vi.fn(thought => [thought])
}))

const author = '/+14151234356'
const DAY_MS = 24 * 60 * 60 * 1000
/** Noon, so a fixture never lands on a day boundary. */
const DAY_START = Date.UTC(2024, 0, 15, 12)

/** Statement and poster items in the shape the feed passes in. */
const item = (kind, day_offset = 0, suffix = '') => ({
  id: `${author}/${kind}/${DAY_START - day_offset * DAY_MS}${suffix}`,
  type: kind
})

const mount_days = props =>
  mount(AsDays, {
    props: {
      statements: [],
      posters: [],
      paginate: true,
      working: false,
      storytelling: false,
      ...props
    },
    slots: {
      default: '<template #default="{ day, date }"><i data-day-item /></template>'
    },
    attachTo: document.body
  })

/** Watchers and the intersection setup run on the next tick after mount. */
const settle = () => flushPromises()

describe('@/components/as-days feed assembly', () => {
  let observers

  beforeEach(() => {
    observers = []
    global.IntersectionObserver = class {
      constructor(callback, options) {
        this.callback = callback
        this.options = options
        this.observed = []
        observers.push(this)
      }
      observe(el) {
        this.observed.push(el)
      }
      unobserve(el) {
        this.observed = this.observed.filter(entry => entry !== el)
      }
      disconnect() {
        this.observed = []
      }
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('groups statements and posters into day articles', async () => {
    const wrapper = mount_days({
      statements: [item('statements', 0)],
      posters: [item('posters', 0)]
    })
    await settle()

    const articles = wrapper.findAll('article')
    expect(articles.length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-day-item]').length).toBeGreaterThan(0)
  })

  it('names a day that is not today', async () => {
    const wrapper = mount_days({
      posters: [item('posters', 0)]
    })
    await settle()

    expect(wrapper.find('article h4[role="heading"]').exists()).toBe(true)
  })

  it('shows the chosen slots in storytelling mode', async () => {
    const wrapper = mount_days({
      storytelling: true,
      posters: [item('posters', 0)]
    })
    await settle()

    expect(wrapper.find('section[data-days] > article').exists()).toBe(true)
    expect(wrapper.findAll('section[data-days] > article > section').length).toBe(
      wrapper.findAll('[data-day-item]').length
    )
  })

  it('keeps every slot when pagination is off', async () => {
    const posters = Array.from({ length: 20 }, (_, index) =>
      item('posters', index)
    )
    const wrapper = mount_days({ posters, paginate: false })
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBe(20)
    expect(wrapper.find('[data-feed-end]').exists()).toBe(false)
  })

  it('shows only the first batch while paginating', async () => {
    const posters = Array.from({ length: 40 }, (_, index) =>
      item('posters', index)
    )
    const wrapper = mount_days({ posters })
    await settle()

    const shown = wrapper.findAll('[data-day-item]').length
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan(40)
  })

  it('loads more slots when the end sentinel is reached', async () => {
    const posters = Array.from({ length: 60 }, (_, index) =>
      item('posters', index)
    )
    const wrapper = mount_days({ posters })
    await settle()
    const first = wrapper.findAll('[data-day-item]').length

    observers.at(-1).callback([
      { isIntersecting: true, target: wrapper.find('[data-feed-end]').element }
    ])
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBeGreaterThan(first)
  })

  it('stops growing once every slot is shown', async () => {
    const wrapper = mount_days({
      posters: [item('posters', 0)]
    })
    await settle()
    const total = wrapper.findAll('[data-day-item]').length

    observers.at(-1).callback([{ isIntersecting: true, target: null }])
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBe(total)
  })

  it('ignores a sentinel entry that is not on screen', async () => {
    const wrapper = mount_days({
      posters: [item('posters', 0)]
    })
    await settle()
    const before = wrapper.findAll('[data-day-item]').length

    observers.at(-1).callback([{ isIntersecting: false, target: null }])
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBe(before)
  })

  it('observes the sentinel and releases it on unmount', async () => {
    const wrapper = mount_days({ posters: [item('posters', 0)] })
    await settle()

    const observer = observers.at(-1)
    expect(observer.observed.length).toBeLessThanOrEqual(1)

    wrapper.unmount()

    expect(observer.observed).toHaveLength(0)
  })

  it('does not watch a sentinel while pagination is off', async () => {
    const wrapper = mount_days({
      paginate: false,
      posters: [item('posters', 0)]
    })
    await settle()

    expect(wrapper.find('[data-feed-end]').exists()).toBe(false)
    expect(observers.at(-1).observed).toHaveLength(0)
  })

  it('refills when a statement keeps its id but changes text', async () => {
    const first = item('statements', 0)
    first.statement = 'before'
    const wrapper = mount_days({ statements: [first] })
    await settle()

    const second = { ...first, statement: 'after' }
    await wrapper.setProps({ statements: [second] })
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBeGreaterThan(0)
  })

  it('recomputes the batch when the window resizes', async () => {
    const wrapper = mount_days({
      posters: Array.from({ length: 30 }, (_, index) =>
        item('posters', index)
      )
    })
    await settle()

    window.dispatchEvent(new Event('resize'))
    await settle()

    expect(wrapper.findAll('[data-day-item]').length).toBeGreaterThan(0)
  })

  describe('author grouping', () => {
    const other = '/+14155550199'
    const from = (phone, kind, day_offset) => ({
      id: `${phone}/${kind}/${DAY_START - day_offset * DAY_MS}`,
      type: kind
    })

    it('groups by author once a day mixes two of them', async () => {
      const wrapper = mount_days({
        statements: [from(author, 'statements', 0)],
        posters: [from(other, 'posters', 0)]
      })
      await settle()

      const day = wrapper.find('article')
      expect(day.exists()).toBe(true)
      expect(wrapper.findAll('[data-day-item]').length).toBeGreaterThan(0)
    })

    it('keeps two days apart when the items span them', async () => {
      const wrapper = mount_days({
        posters: [
          from(author, 'posters', 0),
          from(other, 'posters', 1)
        ]
      })
      await settle()

      expect(wrapper.findAll('article').length).toBeGreaterThan(0)
    })

    it('drops a slot that carries no id at all', async () => {
      const wrapper = mount_days({
        posters: [{ type: 'posters' }]
      })
      await settle()

      expect(wrapper.find('section[data-days]').exists()).toBe(true)
    })
  })

  it('marks the feed role only when neither working nor storytelling', async () => {
    const wrapper = mount_days({ posters: [item('posters', 0)] })
    await settle()
    expect(wrapper.find('section[data-days]').attributes('role')).toBe('feed')

    await wrapper.setProps({ storytelling: true })
    expect(wrapper.find('section[data-days]').attributes('role')).toBeUndefined()
  })
})
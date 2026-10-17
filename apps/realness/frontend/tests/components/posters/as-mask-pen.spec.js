import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick, defineComponent, h } from 'vue'
import AsMaskPen from '@/components/posters/as-mask-pen.vue'

const itemid = '/+14151234356/posters/1000'

const { mock_collect } = vi.hoisted(() => ({
  mock_collect: vi.fn(() => [
    { key: 'sand:0', d: 'M0 0 L10 0 L10 10 Z' },
    { key: 'sand:1', d: 'M20 20 L30 20 L30 30 Z' },
    { key: 'rocks:0', d: 'M40 40 L50 40 L50 50 Z' }
  ])
}))

vi.mock('@/utils/geology', () => ({
  collect_geology_paths: (...args) => mock_collect(...args)
}))

const { mock_read_subjects, mock_write_subjects } = vi.hoisted(() => ({
  mock_read_subjects: vi.fn(() => []),
  mock_write_subjects: vi.fn()
}))

vi.mock('@/utils/subjects', () => ({
  read_subjects: (...args) => mock_read_subjects(...args),
  write_subjects: (...args) => mock_write_subjects(...args)
}))

vi.mock('@/use/poster', () => ({
  geology_layers: ['sediment', 'sand', 'gravel', 'rocks', 'boulders']
}))

vi.mock('@/use/mask-pen', () => ({
  subject_hue: index => index * 40
}))

const create_mask_pen = () => ({
  hovered_key: ref(null),
  selected: ref(new Set()),
  subjects: ref([]),
  active_subject_id: ref(null),
  painting: ref(false),
  toggle_path: vi.fn(),
  add_members: vi.fn(),
  remove_members: vi.fn()
})

const patch_path_el = (el, index) => {
  el.getBBox = () => ({ x: index * 20, y: index * 20, width: 10, height: 10 })
  el.getScreenCTM = () => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse() {
      return this
    }
  })
  el.isPointInFill = pt => {
    const box = el.getBBox()
    return (
      pt.x >= box.x &&
      pt.x <= box.x + box.width &&
      pt.y >= box.y &&
      pt.y <= box.y + box.height
    )
  }
}

/** The hit layer is built after mount, so the synthetic geometry arrives late. */
const patch_hit_paths = wrapper => {
  const hit_paths = [...wrapper.find('g[aria-hidden="true"]').element.children]
  hit_paths.forEach(patch_path_el)
  wrapper.find('svg').element.createSVGPoint = function () {
    return {
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x, y: this.y }
      }
    }
  }
}

const mount_mask_pen = mask_pen => {
  const Halo = defineComponent({
    setup() {
      return () =>
        h('figure', { class: 'poster' }, [
          h(
            'svg',
            {
              viewBox: '0 0 100 100',
              createSVGPoint() {
                return {
                  x: 0,
                  y: 0,
                  matrixTransform() {
                    return { x: this.x, y: this.y }
                  }
                }
              },
              getScreenCTM() {
                return {
                  a: 1,
                  b: 0,
                  c: 0,
                  d: 1,
                  e: 0,
                  f: 0,
                  inverse() {
                    return this
                  }
                }
              }
            },
            [
              h('svg', { 'data-poster-symbol-defs': '' }),
              h(AsMaskPen, { itemid })
            ]
          )
        ])
    }
  })

  return mount(Halo, {
    global: {
      provide: {
        'mask-pen': mask_pen,
        'mask-pen-symbols-ready': ref(true)
      }
    },
    attachTo: document.body
  })
}

describe('@/components/posters/as-mask-pen', () => {
  let mask_pen

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mask_pen = create_mask_pen()
  })

  it('loads geology paths into the hit layer on mount', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    expect(mock_collect).toHaveBeenCalled()
    const hit_layer = wrapper.find('g[data-mask-pen] > g[aria-hidden="true"]')
    expect(hit_layer.element.children).toHaveLength(3)
    expect(wrapper.find('rect').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders selected subject overlays', async () => {
    mask_pen.subjects.value = [
      { id: 's1', keys: new Set(['sand:0', 'rocks:0']) }
    ]
    mask_pen.active_subject_id.value = 's1'
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    expect(wrapper.findAll('path[data-mask-pen="selected"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('toggles a path on click without drag', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()

    const hit_paths = [
      ...wrapper.find('g[aria-hidden="true"]').element.children
    ]
    hit_paths.forEach(patch_path_el)

    const svg = wrapper.find('svg').element
    svg.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y }
        }
      }
    }

    const rect = wrapper.find('rect')
    await rect.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 5,
      clientY: 5
    })
    await rect.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 5,
      clientY: 5
    })

    expect(mask_pen.toggle_path).toHaveBeenCalledWith('sand:0')
    wrapper.unmount()
  })

  it('restores saved subjects when the poster carries them', async () => {
    mock_read_subjects.mockReturnValueOnce([
      { id: 'saved', keys: new Set(['sand:0']) }
    ])
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()

    expect(mask_pen.subjects.value).toEqual([
      { id: 'saved', keys: new Set(['sand:0']) }
    ])
    wrapper.unmount()
  })

  it('saves subjects to the poster once editing settles', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount_mask_pen(mask_pen)
      await flushPromises()
      await nextTick()
      mask_pen.subjects.value = [{ id: 's1', keys: new Set(['sand:0']) }]
      await nextTick()

      expect(mock_write_subjects).not.toHaveBeenCalled()
      vi.advanceTimersByTime(400)

      expect(mock_write_subjects).toHaveBeenCalledWith(
        expect.anything(),
        itemid,
        mask_pen.subjects.value
      )
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves a pending edit when the poster closes first', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount_mask_pen(mask_pen)
      await flushPromises()
      await nextTick()
      mask_pen.subjects.value = [{ id: 's1', keys: new Set(['sand:0']) }]
      await nextTick()

      wrapper.unmount()

      expect(mock_write_subjects).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a hover outline over the cell under the cursor', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    patch_hit_paths(wrapper)

    const rect = wrapper.find('rect')
    await rect.trigger('pointermove', { clientX: 5, clientY: 5 })

    expect(mask_pen.hovered_key.value).toBe('sand:0')
    await nextTick()
    expect(wrapper.find('path[data-mask-pen="hover"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('erases selected cells when a drag starts on one', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    patch_hit_paths(wrapper)
    mask_pen.selected.value = new Set(['sand:0'])

    const rect = wrapper.find('rect')
    await rect.trigger('pointerdown', { clientX: 5, clientY: 5 })
    await rect.trigger('pointermove', { clientX: 25, clientY: 25 })
    await rect.trigger('pointerup', { clientX: 25, clientY: 25 })

    expect(mask_pen.remove_members).toHaveBeenCalled()
    expect(mask_pen.add_members).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a second finger so a pinch does not paint', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    patch_hit_paths(wrapper)

    const rect = wrapper.find('rect')
    await rect.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 5,
      clientY: 5
    })
    await rect.trigger('pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40
    })
    await rect.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40
    })

    expect(mask_pen.add_members).not.toHaveBeenCalled()
    await rect.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'touch'
    })
    await rect.trigger('pointerup', {
      pointerId: 2,
      pointerType: 'touch'
    })
    expect(mask_pen.add_members).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('draws nothing when the pointer never reaches the drag threshold', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    patch_hit_paths(wrapper)

    const rect = wrapper.find('rect')
    await rect.trigger('pointerdown', { clientX: 5, clientY: 5 })
    await rect.trigger('pointermove', { clientX: 6, clientY: 5 })

    expect(mask_pen.painting.value).toBe(false)
    expect(wrapper.find('circle[data-mask-pen="radius"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('grows selection while dragging and commits members', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()

    patch_hit_paths(wrapper)
    wrapper.find('svg').element.getScreenCTM = () => ({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
      inverse() {
        return this
      }
    })

    const rect = wrapper.find('rect')
    await rect.trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 5,
      clientY: 5
    })
    await rect.trigger('pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 25,
      clientY: 5
    })
    expect(mask_pen.painting.value).toBe(true)
    expect(
      wrapper.findAll('path[data-mask-pen="preview"]').length
    ).toBeGreaterThan(0)
    expect(wrapper.find('circle[data-mask-pen="radius"]').exists()).toBe(true)

    await rect.trigger('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 25,
      clientY: 5
    })
    expect(mask_pen.add_members).toHaveBeenCalled()
    expect(mask_pen.painting.value).toBe(false)
    wrapper.unmount()
  })
})

describe('@/components/posters/as-mask-pen geometry', () => {
  let mask_pen

  const patch_path_el_with = (el, box, ctm) => {
    el.getBBox = () => box
    el.getScreenCTM = () => ctm
    el.isPointInFill = () => ctm !== null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mask_pen = create_mask_pen()
  })

  it('carries a path transform into the hit layer', async () => {
    mock_collect.mockReturnValueOnce([
      { key: 'sand:0', d: 'M0 0 L1 1 Z', transform: 'translate(3 4)' }
    ])
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()

    const hit = wrapper.find('g[aria-hidden="true"] path')
    expect(hit.attributes('transform')).toBe('translate(3 4)')
    wrapper.unmount()
  })

  it('clears the hover when the cursor leaves every cell', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    const paths = [...wrapper.find('g[aria-hidden="true"]').element.children]
    for (const el of paths)
      patch_path_el_with(el, { x: 0, y: 0, width: 10, height: 10 }, null)
    wrapper.find('svg').element.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y }
        }
      }
    }

    await wrapper
      .find('rect')
      .trigger('pointermove', { clientX: 5, clientY: 5 })

    expect(mask_pen.hovered_key.value).toBeNull()
    wrapper.unmount()
  })

  it('falls back to the origin when a cell has no transform matrix', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    const paths = [...wrapper.find('g[aria-hidden="true"]').element.children]
    for (const el of paths)
      patch_path_el_with(el, { x: 5, y: 5, width: 10, height: 10 }, null)
    wrapper.find('svg').element.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y }
        }
      }
    }
    Object.defineProperty(wrapper.find('rect').element, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true
    })

    await wrapper
      .find('rect')
      .trigger('pointerdown', { clientX: 5, clientY: 5 })
    await wrapper
      .find('rect')
      .trigger('pointermove', { clientX: 25, clientY: 25 })

    expect(mask_pen.painting.value).toBe(true)
    wrapper.unmount()
  })

  it('ignores a pointer move that is not over any cell', async () => {
    const wrapper = mount_mask_pen(mask_pen)
    await flushPromises()
    await nextTick()
    const paths = [...wrapper.find('g[aria-hidden="true"]').element.children]
    for (const el of paths)
      patch_path_el_with(
        el,
        { x: 100, y: 100, width: 10, height: 10 },
        {
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          e: 0,
          f: 0,
          inverse() {
            return this
          }
        }
      )
    wrapper.find('svg').element.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y }
        }
      }
    }
    for (const el of paths) el.isPointInFill = () => false

    await wrapper
      .find('rect')
      .trigger('pointermove', { clientX: 5, clientY: 5 })

    expect(mask_pen.hovered_key.value).toBeNull()
    wrapper.unmount()
  })
})

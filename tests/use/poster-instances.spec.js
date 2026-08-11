import { describe, it, expect, afterEach } from 'vite-plus/test'
import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { elect_canonical, use_poster_instance } from '@/use/poster-instances'

const DOCUMENT_POSITION_FOLLOWING = 4
const DOCUMENT_POSITION_PRECEDING = 2

/**
 * Stub element ordered by `index` so the election's document-order tie-break is testable
 * without a DOM.
 * @param {number} index
 */
const node = index => ({
  index,
  compareDocumentPosition(other) {
    if (other === this) return 0
    return other.index > this.index
      ? DOCUMENT_POSITION_FOLLOWING
      : DOCUMENT_POSITION_PRECEDING
  }
})

const record = (uid, kind, intersecting, index) => ({
  uid,
  kind,
  intersecting,
  el: node(index)
})

describe('poster-instances election', () => {
  it('elects nobody when no instance is visible', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', false, 1)
    ]
    expect(elect_canonical(records)).toBe(null)
  })

  it('elects the only visible instance', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', true, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('prefers a visible full poster over a visible avatar', () => {
    // avatar earlier in document order, poster later — poster still wins on kind
    const records = [record(1, 'avatar', true, 0), record(2, 'poster', true, 1)]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('breaks ties by document order among the same kind', () => {
    const records = [
      record(1, 'poster', true, 2),
      record(2, 'poster', true, 0),
      record(3, 'poster', true, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('elects a visible avatar when no full poster is visible', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', true, 1),
      record(3, 'avatar', true, 2)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('re-elects when the visible set changes (canonical migrates)', () => {
    const records = [
      record(1, 'poster', true, 0),
      record(2, 'poster', false, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(1)
    // first scrolls away, second scrolls in
    records[0].intersecting = false
    records[1].intersecting = true
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('sorts an instance with no element (null) last in the election', () => {
    const records = [
      record(1, 'poster', true, 0),
      { uid: 2, kind: 'poster', intersecting: true, el: null }
    ]
    expect(elect_canonical(records)?.uid).toBe(1)
    // with only the null-element instance visible it still wins by default
    const only_null = [{ uid: 9, kind: 'poster', intersecting: true, el: null }]
    expect(elect_canonical(only_null)?.uid).toBe(9)
  })
})

const poster_id = '/+16282281824/posters/1730000000000'

/** Deterministic document-order stand-in, ordered by creation so the first mount precedes later ones. */
let _serial = 0
const doc_node = () => {
  const index = _serial++
  return {
    compareDocumentPosition(other) {
      if (other === this) return 0
      return other.index > index
        ? DOCUMENT_POSITION_FOLLOWING
        : DOCUMENT_POSITION_PRECEDING
    }
  }
}

/** Mount one live `use_poster_instance` in a real Vue context. */
function mount_instance({ intersecting = false, kind = 'poster' } = {}) {
  let result
  const el = ref(doc_node())
  const is_intersecting = ref(intersecting)
  const app = defineComponent({
    setup() {
      result = use_poster_instance(() => poster_id, {
        el,
        intersecting: is_intersecting,
        kind
      })
      return { is_intersecting }
    },
    template: '<button @click="is_intersecting = !is_intersecting" />'
  })
  const wrapper = mount(app)
  mounted.push(wrapper)
  return { wrapper, result, is_intersecting }
}

/** Instances cleaned up in afterEach so the shared registry does not leak across tests. */
const mounted = []

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
})

describe('use_poster_instance lifecycle', () => {
  it('a single visible instance is canonical and does not reference', () => {
    const { result } = mount_instance({ intersecting: true })
    expect(result.am_canonical.value).toBe(true)
    expect(result.use_reference.value).toBe(false)
    expect(result.is_referenced.value).toBe(false) // list length is 1
  })

  it('re-elects via the intersecting watch as instances scroll in and out', async () => {
    const a = mount_instance({ intersecting: true })
    const b = mount_instance({ intersecting: false })
    expect(a.result.am_canonical.value).toBe(true)
    expect(b.result.am_canonical.value).toBe(false)

    b.is_intersecting.value = true
    await nextTick()
    // same kind, a earlier in document order -> a still canonical
    expect(a.result.am_canonical.value).toBe(true)

    a.is_intersecting.value = false
    await nextTick()
    expect(b.result.am_canonical.value).toBe(true)
    expect(a.result.am_canonical.value).toBe(false)
    // b stops referencing (the canonical it referenced is now itself)
    expect(b.result.use_reference.value).toBe(false)
  })

  it('references a canonical render in another instance after a frame', async () => {
    const a = mount_instance({ intersecting: false })
    const b = mount_instance({ intersecting: false })
    expect(b.result.use_reference.value).toBe(false)
    // a scrolls in -> a becomes canonical; b defers referencing by a frame so a paints first
    a.is_intersecting.value = true
    await nextTick()
    expect(a.result.am_canonical.value).toBe(true)
    expect(b.result.use_reference.value).toBe(false) // hand-off still pending on rAF
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(b.result.use_reference.value).toBe(true)
    expect(a.result.is_referenced.value).toBe(true)
    expect(b.result.reference_target_id.value).toBeTruthy()
  })

  it('prefers a full poster over an avatar when both are visible', () => {
    const a = mount_instance({ intersecting: true, kind: 'poster' })
    const b = mount_instance({ intersecting: true, kind: 'avatar' })
    expect(a.result.am_canonical.value).toBe(true)
    expect(b.result.am_canonical.value).toBe(false)
  })

  it('references immediately when requestAnimationFrame is unavailable', async () => {
    const real_raf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = undefined
    const a = mount_instance({ intersecting: false })
    const b = mount_instance({ intersecting: false })
    a.is_intersecting.value = true
    await nextTick()
    // no frame to wait on -> b references at once
    expect(b.result.use_reference.value).toBe(true)
    expect(a.result.is_referenced.value).toBe(true)
    globalThis.requestAnimationFrame = real_raf
  })

  it('frees its record on unmount so a fresh instance is standalone canonical', () => {
    const a = mount_instance({ intersecting: true })
    expect(a.result.am_canonical.value).toBe(true)
    a.wrapper.unmount()
    const b = mount_instance({ intersecting: true })
    expect(b.result.am_canonical.value).toBe(true)
    expect(b.result.is_referenced.value).toBe(false)
  })
})

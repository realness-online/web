import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { use_delegated_pan } from '@/use/delegated-pan'

// Real touch event on an element. happy-dom exposes TouchEvent but not the
// TouchList it populates by default, so we attach a plain touches array.
const fire = (el, type, touches) => {
  const evt = new Event(type, { cancelable: true, bubbles: true })
  Object.defineProperty(evt, 'touches', {
    value: touches.map((t, i) => ({
      identifier: t.identifier ?? i,
      clientX: t.clientX,
      clientY: t.clientY
    }))
  })
  el.dispatchEvent(evt)
  return evt
}

// Build a container with one registered poster target and pannable callbacks.
const setup = ({ can_pan = () => true, max_pan = () => 100 } = {}) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const svg = document.createElement('svg')
  svg.setAttribute('itemtype', '/posters')
  container.appendChild(svg)

  const get_can_pan = vi.fn(can_pan)
  const get_max_pan_px = vi.fn(max_pan)
  const { register } = use_delegated_pan(ref(container))
  const pan = register(ref(svg), { get_can_pan, get_max_pan_px })
  return { container, svg, pan, get_can_pan, get_max_pan_px }
}

describe('@/use/delegated-pan', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not start a gesture on a touch outside a registered poster', () => {
    const { container } = setup()
    fire(container, 'touchstart', [{ clientX: 10, clientY: 10 }])
    const evt = fire(container, 'touchmove', [{ clientX: 60, clientY: 10 }])
    expect(evt.defaultPrevented).toBe(false)
  })

  it('ignores a start when panning is disallowed', () => {
    const { container, svg, pan, get_can_pan } = setup({ can_pan: () => false })
    expect(get_can_pan()).toBe(false)
    fire(svg, 'touchstart', [{ clientX: 10, clientY: 10 }])
    fire(svg, 'touchmove', [{ clientX: 60, clientY: 10 }])
    expect(pan.pan_offset.value).toBe(0)
  })

  it('panning becomes active once movement passes the gesture threshold', () => {
    const { svg, pan } = setup()
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    const evt = fire(svg, 'touchmove', [{ clientX: 30, clientY: 0 }])
    expect(evt.defaultPrevented).toBe(true)
    expect(pan.panning.value).toBe(true)
    expect(pan.pan_offset.value).toBe(30)
  })

  it('reads the max pan from callback and rubber-bands past it', () => {
    const { svg, pan } = setup({ max_pan: () => 100 })
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    const evt = fire(svg, 'touchmove', [{ clientX: 200, clientY: 0 }])
    expect(evt.defaultPrevented).toBe(true)
    // raw 200, max 100, overflow 100 * 0.25 = 25 -> 125
    expect(pan.pan_offset.value).toBe(125)
  })

  it('rubber-bands when dragging past the negative max', () => {
    const { svg, pan } = setup({ max_pan: () => 100 })
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    const evt = fire(svg, 'touchmove', [{ clientX: -200, clientY: 0 }])
    expect(evt.defaultPrevented).toBe(true)
    expect(pan.pan_offset.value).toBe(-125)
  })

  it('treats a predominantly vertical gesture as not a horizontal pan', () => {
    const { svg, pan } = setup()
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    const evt = fire(svg, 'touchmove', [{ clientX: 5, clientY: 40 }])
    expect(evt.defaultPrevented).toBe(false)
    expect(pan.pan_offset.value).toBe(0)
  })

  it('clamps the offset to max and marks the pan on end', () => {
    const { svg, pan } = setup()
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    fire(svg, 'touchmove', [{ clientX: 200, clientY: 0 }])
    fire(svg, 'touchend', [])
    expect(pan.pan_offset.value).toBe(100)
    expect(pan.was_pan_gesture.value).toBe(true)
    expect(pan.panning.value).toBe(false)
  })

  it('keeps a gesture alive while the tracked finger is still down', () => {
    const { svg, pan } = setup()
    fire(svg, 'touchstart', [{ identifier: 1, clientX: 0, clientY: 0 }])
    // touchend still lists the tracked finger -> gesture stays live
    fire(svg, 'touchend', [{ identifier: 1, clientX: 40, clientY: 0 }])
    expect(pan.panning.value).toBe(true)
  })

  it('unregister prevents a subsequent touch from starting a gesture', () => {
    const { svg, pan } = setup()
    pan.unregister()
    fire(svg, 'touchstart', [{ clientX: 0, clientY: 0 }])
    const evt = fire(svg, 'touchmove', [{ clientX: 40, clientY: 0 }])
    expect(evt.defaultPrevented).toBe(false)
    expect(pan.pan_offset.value).toBe(0)
  })
})

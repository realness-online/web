import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import { shallowMount as shallow_mount } from '@vue/test-utils'
import { use_touch_callout } from '@/use/touch-callout'

let app
let surface
const pointer = (type, target = surface) => {
  const event = new PointerEvent('pointerdown', {
    pointerType: type,
    bubbles: true,
    cancelable: true
  })
  target.dispatchEvent(event)
  return event
}
const contextmenu = (target = surface) => {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true
  })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  surface = document.createElement('section')
  document.body.append(surface)
  app = shallow_mount({
    setup() {
      use_touch_callout()
      return () => null
    }
  })
})
afterEach(() => {
  app.unmount()
  surface.remove()
})

describe('@/use/touch-callout', () => {
  it('blocks a touch callout on the app surface', () => {
    pointer('touch')
    expect(contextmenu().defaultPrevented).toBe(true)
  })

  it('records touch even when a child stops pointer propagation', () => {
    surface.addEventListener('pointerdown', event => event.stopPropagation())
    pointer('touch')
    expect(contextmenu().defaultPrevented).toBe(true)
  })

  it('blocks a control callout even when the control stops propagation', () => {
    surface.addEventListener('contextmenu', event => event.stopPropagation())
    pointer('touch')
    expect(contextmenu().defaultPrevented).toBe(true)
  })

  it('keeps desktop right-click available after switching from touch', () => {
    pointer('touch')
    pointer('mouse')
    expect(contextmenu().defaultPrevented).toBe(false)
  })

  it.each(['textarea', 'input', 'p[contenteditable="true"]'])(
    'preserves selection and paste in %s',
    selector => {
      const element = document.createElement(selector.split('[')[0])
      if (selector.includes('contenteditable'))
        element.setAttribute('contenteditable', 'true')
      const child = document.createElement('span')
      element.append(child)
      surface.append(element)
      pointer('touch', element)
      expect(contextmenu(child).defaultPrevented).toBe(false)
    }
  )

  it('does not cancel the pointer or click that toggles a native switch', () => {
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.setAttribute('switch', '')
    surface.append(toggle)
    const change = vi.fn()
    toggle.addEventListener('change', change)
    expect(pointer('touch', toggle).defaultPrevented).toBe(false)
    expect(contextmenu(toggle).defaultPrevented).toBe(true)
    toggle.click()
    expect(toggle.checked).toBe(true)
    expect(change).toHaveBeenCalledOnce()
  })

  it('does not intercept touchmove, wheel, or pointerup', () => {
    pointer('touch')
    for (const type of ['touchmove', 'wheel', 'pointerup']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      surface.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('removes its listeners when the app unmounts', () => {
    pointer('touch')
    app.unmount()
    expect(contextmenu().defaultPrevented).toBe(false)
  })
})

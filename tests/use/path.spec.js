import { useActiveElement } from '@vueuse/core'
import { vi } from 'vitest'
import { itemprop_query, create_path_element, use, change_by } from '@/use/path'

describe('@/use/path.js', () => {
  let console_warn_spy

  beforeEach(() => {
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (console_warn_spy) console_warn_spy.mockRestore()
  })
  describe('#create_path_element', () => {
    it('Creates path element', () => {
      const path = create_path_element()
      expect(path.nodeName).toBe('path')
    })
  })
  describe('#fill_opacity', () => {
    it('Increases fill opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="fill-opacity:0.025;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { fill_opacity } = use()
      expect(active.value.style.fillOpacity).toBe('0.025')
      fill_opacity(change_by) // use the default change_by constant
      expect(parseFloat(active.value.style.fillOpacity)).toBeCloseTo(0.105, 2)
    })
    it('Decreases fill opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="fill-opacity:0.5;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { fill_opacity } = use()
      expect(active.value.style.fillOpacity).toBe('0.5')
      fill_opacity(-change_by)
      expect(active.value.style.fillOpacity).toBe('0.42') // 0.5 - 0.08
    })
  })

  describe('#stroke_opacity', () => {
    it('Increases stroke opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="stroke-opacity:0.025;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { stroke_opacity } = use()
      expect(active.value.style.strokeOpacity).toBe('0.025')
      stroke_opacity(change_by)
      expect(parseFloat(active.value.style.strokeOpacity)).toBeCloseTo(0.105, 2)
    })
    it('Decreases stroke opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="stroke-opacity:0.5;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { stroke_opacity } = use()
      expect(active.value.style.strokeOpacity).toBe('0.5')
      stroke_opacity(-change_by)
      expect(active.value.style.strokeOpacity).toBe('0.42') // 0.5 - 0.08
    })
  })

  describe('#opacity', () => {
    it('Increases opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="opacity:0.025;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { opacity } = use()
      expect(active.value.style.opacity).toBe('0.025')
      opacity(change_by)
      expect(parseFloat(active.value.style.opacity)).toBeCloseTo(0.105, 2)
    })
    it('Decreases opacity', () => {
      window.document.body.innerHTML =
        '<path id="test" tabindex="0" itemprop="bold" style="opacity:0.5;"/>'
      itemprop_query('bold').focus()
      const active = useActiveElement()
      const { opacity } = use()
      expect(active.value.style.opacity).toBe('0.5')
      opacity(-change_by)
      expect(active.value.style.opacity).toBe('0.42') // 0.5 - 0.08
    })
  })
})

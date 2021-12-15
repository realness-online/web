import { useActiveElement } from '@vueuse/core'
import {
  itemprop_query,
  create_path_element,
  fill_opacity,
  stroke_opacity,
  opacity
} from '@/use/path-style'

describe('@/use/path-style.js', () => {
  describe('#create_path_element', () => {
    it('Creates path element', () => {
      const path = create_path_element()
      expect(path.nodeName).toBe('path')
    })
  })
  describe('#fill_opacity', () => {
    it('Increases fill opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="fill-opacity:0.025;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.fillOpacity).toBe('0.025')
      fill_opacity() // default is more by 0.025
      expect(active.value.style.fillOpacity).toBe('0.05')
    })
    it('Decreases fill opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="fill-opacity:0.5;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.fillOpacity).toBe('0.5')
      fill_opacity(-0.025)
      expect(active.value.style.fillOpacity).toBe('0.475')
    })
  })

  describe('#stroke_opacity', () => {
    it('Increases stroke opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="stroke-opacity:0.025;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.strokeOpacity).toBe('0.025')
      stroke_opacity() // default is more by 0.025
      expect(active.value.style.strokeOpacity).toBe('0.05')
    })
    it('Decreases stroke opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="stroke-opacity:0.5;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.strokeOpacity).toBe('0.5')
      stroke_opacity(-0.025)
      expect(active.value.style.strokeOpacity).toBe('0.475')
    })
  })

  describe('#opacity', () => {
    it('Increases opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="opacity:0.025;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.opacity).toBe('0.025')
      opacity(0.025) // default is more by 0.025
      expect(active.value.style.opacity).toBe('0.05')
    })
    it('Decreases opacity', () => {
      window.document.body.innerHTML = `<path id="test" tabindex="0" itemprop="bold" style="opacity:0.5;"/>`
      itemprop_query('bold').focus()
      const active = useActiveElement()
      expect(active.value.style.opacity).toBe('0.5')
      opacity(-0.025)
      expect(active.value.style.opacity).toBe('0.475')
    })
  })
})

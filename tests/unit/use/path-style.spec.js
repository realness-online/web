import {
  get_active_id,
  create_path_element,
  fill_opacity,
  stroke_opacity,
  opacity
} from '@/use/path-style'

describe('@/use/path-style.js', () => {
  describe('#get_active_id', () => {
    it('Returns the active element', () => {
      window.document.body.innerHTML = `<a id="test"
        href="#6282281824/posters/5598674934">I am a link</a>`
      document.getElementById('test').focus()
      const id = get_active_id()
      expect(id).toBe('6282281824/posters/5598674934')
    })
  })
  describe('#fill_opacity', () => {
    it('Changes opacity by degree', () => {
      window.document.body.innerHTML = `<a id="test"
        href="#path-id">I am a link</a>
        <path id="path-id" fill-opacity="0.233">`
      document.getElementById('test').focus()
      const new_opacity = fill_opacity('0.25')
    })
  })
})

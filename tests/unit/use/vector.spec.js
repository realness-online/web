describe('Computed', () => {
  describe('.viewbox', () => {
    it("Returns the vector's viewbox", () => {
      wrapper.vm.vector = poster
      expect(wrapper.vm.viewbox).toBe('0 0 333 444')
    })
    it('Always returns a value', () => {
      expect(wrapper.vm.vector).toBe(null)
      expect(wrapper.vm.viewbox).toBe('0 0 16 16')
    })
  })
})
describe('Watchers', () => {
  describe('poster', () => {
    it('Updates vector when changed', async () => {
      const other_poster = { ...poster }
      other_poster.id = '/fake_id'
      await wrapper.vm.show()
      await wrapper.setProps({ poster: other_poster })
      expect(wrapper.vm.vector.id).toBe('/fake_id')
    })
    it('Leaves vector alone when poster is null', async () => {
      await wrapper.setProps({ poster })
      expect(wrapper.vm.vector.id).toBe(poster.id)
      await wrapper.setProps({ poster: null })
      expect(wrapper.vm.vector.id).toBe(poster.id)
    })
  })
})
describe('Methods', () => {
  describe('#show', () => {
    it('Sets vector to the poster prop', async () => {
      wrapper = await shallowMount(as_svg, {
        props: { poster, itemid: poster.id, immediate: true }
      }) // show is called when immediate is true
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.vector.id).toBe(poster.id)
      expect(wrapper.emitted('vector-loaded')).toBeTruthy()
    })
    it('Only loads the vector once', async () => {
      wrapper.vm.vector = poster
      await wrapper.vm.show()
      expect(wrapper.emitted('vector-loaded')).not.toBeTruthy()
    })
  })
})

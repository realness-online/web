import { mount } from '@vue/test-utils'
import as_animation from '@/components/posters/as-animation.vue'

describe('@/component/posters/as-animation.vue', () => {
  it('starts every SMIL animation immediately (none left as begin="indefinite")', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const wrapper = mount(as_animation, {
      props: {
        id: '/+14151234356/posters/1770000000000',
        svg,
        paused: false
      }
    })

    // The template also nests plain `<animate>` elements as structural
    // groupers (e.g. `itemprop="timeline"`); only the leaf animations that
    // declare `attributeName` are real SMIL animations with a `begin`.
    const animations = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename'))
    expect(animations.length).toBeGreaterThan(0)
    animations.forEach(animation => {
      expect(animation.attributes('begin')).toBe('0s')
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Colors from '@/views/Colors.vue'

describe('@/views/Colors', () => {
  it('renders the color system reference', () => {
    const wrapper = mount(Colors)
    expect(wrapper.find('section#colors[data-page]').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Color')

    const roles = wrapper.findAll('article[itemprop="roles"] > ul > li')
    expect(roles.map(role => role.find('header code').text())).toEqual([
      '--accent',
      '--working',
      '--emphasis',
      '--warning'
    ])

    const paints = wrapper.findAll(
      'article[itemprop="variants"] > figure[itemscope]'
    )
    expect(paints.map(figure => figure.attributes('itemprop'))).toEqual([
      'water',
      'clay',
      'slate'
    ])
    paints.forEach(figure => expect(figure.findAll('ul > li')).toHaveLength(3))

    const layers = wrapper.findAll(
      'details[itemprop="geology"] > figure[itemscope]'
    )
    expect(layers.map(figure => figure.attributes('itemprop'))).toEqual([
      'sediment',
      'sand',
      'gravel',
      'rocks',
      'boulders'
    ])
    layers.forEach(figure => expect(figure.findAll('ul > li')).toHaveLength(3))

    expect(
      wrapper.findAll(
        'details[itemprop="geology"] > figure:last-of-type ol > li'
      )
    ).toHaveLength(5)

    expect(
      wrapper.findAll('article[itemprop="palette"] > figure ul li')
    ).toHaveLength(4)

    expect(
      wrapper.findAll('article[itemprop="signals"] > ul > li')
    ).toHaveLength(2)
    expect(
      wrapper.findAll(
        'article[itemprop="surfaces"] > figure:first-of-type ol > li'
      )
    ).toHaveLength(5)
  })

  describe('the weight disclosure', () => {
    it('reports the weights as closed until the heading is used', async () => {
      const wrapper = mount(Colors)
      const toggle = wrapper.find(
        'article[itemprop="roles"] header[role="button"]'
      )

      expect(toggle.attributes('aria-expanded')).toBe('false')

      await toggle.trigger('click')
      expect(toggle.attributes('aria-expanded')).toBe('true')

      await toggle.trigger('click')
      expect(toggle.attributes('aria-expanded')).toBe('false')
    })

    it('opens the weights from the keyboard too', async () => {
      const wrapper = mount(Colors)
      const toggle = wrapper.find(
        'article[itemprop="roles"] header[role="button"]'
      )

      await toggle.trigger('keydown.enter')

      expect(toggle.attributes('aria-expanded')).toBe('true')
    })
  })

  describe('the palette preview', () => {
    it('starts on the accent and emphasis pairing', () => {
      const wrapper = mount(Colors)
      const bar = wrapper.find('article[itemprop="palette"] summary')

      expect(bar.findAll('b[itemprop="variant"]')).toHaveLength(2)
      expect(
        wrapper
          .find('article[itemprop="palette"] code[itemprop="role"]')
          .exists()
      ).toBe(true)
    })

    it('previews a chosen variant pair and drops the role labels', async () => {
      const wrapper = mount(Colors)
      const buttons = wrapper.findAll('article[itemprop="palette"] button')
      const choice = buttons[1]
      const pair = choice.findAll('samp').map(samp => samp.text())

      await choice.trigger('click')

      const bar = wrapper.find('article[itemprop="palette"] summary')
      const shown = bar.findAll('b[itemprop="variant"]').map(b => b.text())
      expect(shown).toEqual(pair)
      expect(choice.attributes('aria-pressed')).toBe('true')
      expect(
        wrapper
          .find('article[itemprop="palette"] code[itemprop="role"]')
          .exists()
      ).toBe(false)
    })

    it('returns to the role pairing from the first button', async () => {
      const wrapper = mount(Colors)
      const buttons = wrapper.findAll('article[itemprop="palette"] button')

      await buttons[1].trigger('click')
      await buttons[0].trigger('click')

      expect(buttons[0].attributes('aria-pressed')).toBe('true')
      expect(
        wrapper
          .find('article[itemprop="palette"] code[itemprop="role"]')
          .exists()
      ).toBe(true)
    })

    it('offers each variant pairing once', () => {
      const wrapper = mount(Colors)
      const combos = wrapper
        .findAll('article[itemprop="palette"] li button')
        .slice(1)
        .map(button => button.findAll('samp').map(samp => samp.text()))
      const keys = combos.map(([a, b]) => `${a}-${b}`)

      expect(new Set(keys).size).toBe(keys.length)
      expect(combos).toHaveLength(3)
    })
  })

  describe('resolved paints', () => {
    beforeEach(() => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: () => ' oklch(0.62 0.11 210) '
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('lists every variant and signal as a shelf stop', () => {
      const wrapper = mount(Colors)
      const stops = wrapper.findAll('article[itemprop="palette"] li[itemscope]')

      expect(stops.map(stop => stop.attributes('itemprop'))).toEqual([
        'water',
        'clay',
        'slate',
        'ochre'
      ])
    })

    it('keeps the palette details closed until the reader opens them', () => {
      const wrapper = mount(Colors)
      const details = wrapper.find('article[itemprop="palette"] details')

      expect(details.element.open).toBe(false)
    })
  })
})

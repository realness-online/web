import { afterEach as after_each, describe, expect, it } from 'vite-plus/test'
import { read_filters, write_filters } from '@/utils/url-filters'

after_each(() => history.replaceState(null, '', '/'))

describe('@/utils/url-filters', () => {
  it('reads only the names it is asked for', () => {
    expect(
      read_filters('?fate=keep&open=1&other=x', ['fate', 'open', 'avatar'])
    ).toEqual({
      fate: 'keep',
      open: '1'
    })
  })

  it('writes set values and leaves defaults out of the link', () => {
    history.replaceState(null, '', '/planning/maps/modules#top')
    write_filters({
      fate: 'keep',
      avatar: '',
      open: true,
      closed: false,
      section: ['Solo', 'Cloud']
    })
    expect(location.search).toBe('?fate=keep&open=1&section=Solo%2CCloud')
    expect(location.hash).toBe('#top')
    write_filters({ fate: '' })
    expect(location.search).toBe('')
  })
})

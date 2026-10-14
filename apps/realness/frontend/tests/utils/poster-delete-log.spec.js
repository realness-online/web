import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { poster_delete_log } from '@/utils/poster-delete-log'

describe('@/utils/poster-delete-log', () => {
  let info

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    info.mockRestore()
    delete window.localStorage['debug:poster-delete']
  })

  it('stays silent unless the debug flag is on', () => {
    poster_delete_log('where', { id: '/+1/posters/1' })

    expect(info).not.toHaveBeenCalled()
  })

  it('logs the call site with a stack when the flag is on', () => {
    window.localStorage['debug:poster-delete'] = 'on'

    poster_delete_log('purge', { id: '/+1/posters/2' })

    expect(info).toHaveBeenCalledWith(
      '[poster-delete] purge',
      { id: '/+1/posters/2' },
      expect.stringContaining('poster-delete')
    )
  })

  it('accepts a call with no detail', () => {
    window.localStorage['debug:poster-delete'] = 'on'

    poster_delete_log('bare')

    expect(info).toHaveBeenCalledWith(
      '[poster-delete] bare',
      {},
      expect.any(String)
    )
  })
})

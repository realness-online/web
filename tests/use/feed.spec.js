import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { use_feed } from '@/use/feed'

describe('use_feed', () => {
  it('runs on_refresh when refresh_signal changes instead of load_feed_for_people', async () => {
    const posters = ref([])
    const statements = ref([])
    const statements_for_person = vi.fn().mockResolvedValue(undefined)
    const posters_for_person = vi.fn().mockResolvedValue(undefined)
    const refresh_signal = ref(0)
    const on_refresh = vi.fn().mockResolvedValue(undefined)

    use_feed({
      posters,
      statements,
      statements_for_person,
      posters_for_person,
      refresh_signal,
      on_refresh,
      set_working: undefined
    })

    refresh_signal.value = Date.now()
    await nextTick()

    expect(on_refresh).toHaveBeenCalledTimes(1)
    expect(statements_for_person).not.toHaveBeenCalled()
    expect(posters_for_person).not.toHaveBeenCalled()
  })
})

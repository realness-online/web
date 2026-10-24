import { describe, it, expect, vi } from 'vite-plus/test'
import {
  shallowMount as shallow_mount,
  flushPromises as flush_promises
} from '@vue/test-utils'
import { defineComponent as define_component, ref } from 'vue'
import { readFile as read_file } from 'node:fs/promises'
import { use_sign_on } from 'realness/sign-on/flow'

const mount_flow = (profile, user = null) =>
  shallow_mount(
    define_component({
      emits: ['signed_in', 'showing_mobile'],
      setup(_, { emit }) {
        return use_sign_on({ current_user: ref(user), profile, emit })
      },
      template: `<section>
    <button v-if="!nameless" @click="on_signed_on">Verify</button>
    <button v-else @click="on_name_valid">Save name</button>
  </section>`
    })
  )

const profile_adapter = () => ({
  is_valid_name: ref(false),
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined)
})

describe('sign-in storage boundary', () => {
  it('keeps profile persistence outside the flow and its component', async () => {
    for (const path of [
      '../../../src/sign-on/browser/flow.js',
      '../../../src/app/components/profile/as-sign-on.vue'
    ]) {
      const source = await read_file(new URL(path, import.meta.url), 'utf8')
      expect(source).not.toContain('@/utils/itemid')
      expect(source).not.toContain('@/use/people')
      expect(source).not.toContain('localStorage')
    }
  })

  it('completes phone verification using an injected profile', async () => {
    const profile = profile_adapter()
    profile.is_valid_name.value = true
    profile.load.mockResolvedValue({ name: 'Odessa' })
    const wrapper = mount_flow(profile)
    await wrapper.get('button').trigger('click')
    await flush_promises()
    expect(profile.load).toHaveBeenCalledOnce()
    expect(wrapper.emitted('signed_in')).toEqual([[]])
    wrapper.unmount()
  })

  it('asks for a name when no profile exists, then saves before completing', async () => {
    const profile = profile_adapter()
    let finish_save
    profile.save.mockImplementation(
      () =>
        new Promise(resolve => {
          finish_save = resolve
        })
    )
    const wrapper = mount_flow(profile)
    await wrapper.get('button').trigger('click')
    await flush_promises()
    expect(wrapper.get('button').text()).toBe('Save name')
    expect(wrapper.emitted('signed_in')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    await flush_promises()
    expect(profile.save).toHaveBeenCalledOnce()
    expect(wrapper.emitted('signed_in')).toBeUndefined()
    finish_save()
    await flush_promises()
    expect(wrapper.emitted('signed_in')).toEqual([[]])
    wrapper.unmount()
  })

  it('opens the name step for a signed-in person without a valid name', () => {
    const wrapper = mount_flow(profile_adapter(), { uid: 'odessa' })
    expect(wrapper.get('button').text()).toBe('Save name')
    expect(wrapper.emitted('showing_mobile')).toEqual([[false]])
    wrapper.unmount()
  })
})

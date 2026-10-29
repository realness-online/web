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
    <button v-if="pending">Checking</button>
    <button v-else-if="!nameless" @click="on_signed_on">Verify</button>
    <button v-else @click="on_name_valid">Save name</button>
  </section>`
    })
  )

const profile_adapter = () => ({
  loaded: ref(false),
  is_valid_name: ref(false),
  load: vi.fn(async function () {
    await Promise.resolve()
    this.loaded.value = true
    return null
  }),
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
    profile.load.mockImplementation(async () => {
      await Promise.resolve()
      profile.loaded.value = true
      return { name: 'Odessa' }
    })
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

  it('opens the name step for a signed-in person without a valid name', async () => {
    const wrapper = mount_flow(profile_adapter(), { uid: 'odessa' })
    expect(wrapper.text()).toContain('Checking')
    await flush_promises()
    expect(wrapper.get('button').text()).toBe('Save name')
    expect(wrapper.emitted('showing_mobile').at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('waits for the profile load before showing the name step', async () => {
    const profile = profile_adapter()
    profile.load.mockImplementation(() => new Promise(() => {}))
    const wrapper = mount_flow(profile, { uid: 'odessa' })
    expect(wrapper.text()).toContain('Checking')
    expect(wrapper.text()).not.toContain('Save name')
    wrapper.unmount()
  })

  it('routes on once the boot profile arrives with a valid name', async () => {
    const profile = profile_adapter()
    const wrapper = mount_flow(profile, { uid: 'odessa' })
    expect(wrapper.text()).toContain('Checking')
    profile.is_valid_name.value = true
    profile.loaded.value = true
    await flush_promises()
    expect(wrapper.emitted('signed_in')).toEqual([[]])
    expect(wrapper.text()).not.toContain('Save name')
    wrapper.unmount()
  })

  it('leaves the name step once the saved profile name arrives', async () => {
    const profile = profile_adapter()
    profile.load.mockImplementation(async () => {
      await Promise.resolve()
      profile.loaded.value = true
      return { name: 'Odessa' }
    })
    const wrapper = mount_flow(profile, { uid: 'odessa' })
    await flush_promises()
    expect(wrapper.get('button').text()).toBe('Save name')
    profile.is_valid_name.value = true
    await flush_promises()
    expect(wrapper.get('button').text()).toBe('Verify')
    expect(wrapper.emitted('signed_in')).toEqual([[]])
    wrapper.unmount()
  })
})

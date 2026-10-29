import { computed, ref, watchEffect as watch_effect } from 'vue'

/**
 * Phone and name steps; the caller owns authentication and profile storage.
 * The name step waits for the profile load, so a good stored name skips it.
 * @param {{ current_user: import('vue').Ref<unknown>, profile: { loaded: import('vue').Ref<boolean>, is_valid_name: import('vue').Ref<boolean>, load: () => Promise<unknown>, save: () => Promise<void> }, emit: (event: 'signed_in' | 'showing_mobile', ...args: boolean[]) => void }} options
 */
export const use_sign_on = ({ current_user, profile, emit }) => {
  const nameless = ref(false)
  const pending = computed(() => !!current_user.value && !profile.loaded.value)

  const decide = () => {
    if (!profile.loaded.value) return
    if (profile.is_valid_name.value) {
      nameless.value = false
      emit('signed_in')
    } else nameless.value = true
  }

  const on_signed_on = async () => {
    await profile.load()
    decide()
  }

  const on_name_valid = async () => {
    await profile.save()
    emit('signed_in')
  }

  watch_effect(() => {
    if (!current_user.value) return
    if (!profile.loaded.value) {
      void profile.load()
      return
    }
    decide()
  })

  watch_effect(() => {
    emit('showing_mobile', !nameless.value)
  })

  return { nameless, pending, on_signed_on, on_name_valid }
}

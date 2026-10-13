import { ref, watchEffect as watch_effect } from 'vue'

/**
 * Phone and name steps; the caller owns authentication and profile storage.
 * @param {{ current_user: import('vue').Ref<unknown>, profile: { is_valid_name: import('vue').Ref<boolean>, load: () => Promise<unknown>, save: () => Promise<void> }, emit: (event: 'signed_in' | 'showing_mobile', ...args: boolean[]) => void }} options
 */
export const use_sign_on = ({ current_user, profile, emit }) => {
  const nameless = ref(false)

  const on_signed_on = async () => {
    const loaded = await profile.load()
    if (loaded && profile.is_valid_name.value) emit('signed_in')
    else nameless.value = true
  }

  const on_name_valid = async () => {
    await profile.save()
    emit('signed_in')
  }

  watch_effect(() => {
    if (current_user.value && !profile.is_valid_name.value)
      nameless.value = true
  })

  watch_effect(() => {
    emit('showing_mobile', !nameless.value)
  })

  return { nameless, on_signed_on, on_name_valid }
}

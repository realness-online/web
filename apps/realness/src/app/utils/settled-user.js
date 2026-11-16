import { watch } from 'vue'
import { current_user } from '@/utils/serverless'

/**
 * The signed-in user once Firebase has restored the session; null if none.
 * A page load starts at undefined, which means not known yet.
 */
export const settled_user = () => {
  if (current_user.value !== undefined) return current_user.value
  return new Promise(resolve => {
    const stop = watch(current_user, user => {
      if (user === undefined) return
      stop()
      resolve(user)
    })
  })
}

/** The signed-in user's token, once known; null for a stranger. */
export const settled_token = async () =>
  (await (await settled_user())?.getIdToken()) ?? null

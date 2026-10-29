import { use_me } from '@/use/people'
import { load, load_from_network } from '@/utils/itemid'
import { ref } from 'vue'

/** Realness's profile adapter; sign-in state does not own poster storage. */
export const use_sign_on_profile = () => {
  const { is_valid_name, save, me } = use_me()
  const loaded = ref(false)
  return {
    loaded,
    is_valid_name,
    save,
    async load() {
      const network_profile = await load_from_network(localStorage.me)
      const local_profile = await load(localStorage.me)
      const found = network_profile ?? local_profile
      if (found && me?.value)
        me.value = {
          ...me.value,
          type: 'person',
          ...(typeof found.name === 'string' && { name: found.name }),
          ...(typeof found.avatar === 'string' && { avatar: found.avatar })
        }
      loaded.value = true
      return found
    }
  }
}

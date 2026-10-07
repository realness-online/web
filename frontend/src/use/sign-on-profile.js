import { use_me } from '@/use/people'
import { load, load_from_network } from '@/utils/itemid'

/** Realness's profile adapter; sign-in state does not own poster storage. */
export const use_sign_on_profile = () => {
  const { is_valid_name, save } = use_me()

  return {
    is_valid_name,
    save,
    async load() {
      const network_profile = await load_from_network(localStorage.me)
      const local_profile = await load(localStorage.me)
      return network_profile || local_profile
    }
  }
}

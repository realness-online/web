import { vi } from 'vite-plus/test'

const auth = {
  current_user: null,
  sign_in: vi.fn(),
  sign_out: vi.fn(),
  create_user: vi.fn(),
  delete_user: vi.fn(),
  on_auth_state_changed: callback => {
    auth._auth_state_callback = callback
    if (callback) callback(auth.current_user)
    return () => {
      auth._auth_state_callback = null
    }
  },

  set_current_user(user) {
    auth.current_user = user
    if (auth._auth_state_callback) {
      auth._auth_state_callback(user)
    }
  },

  reset() {
    auth.current_user = null
    auth._auth_state_callback = null
    auth.sign_in.mockClear()
    auth.sign_out.mockClear()
    auth.create_user.mockClear()
    auth.delete_user.mockClear()
  }
}

export default auth

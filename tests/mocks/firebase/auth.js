import { vi } from 'vitest'

const auth = {
  current_user: null,
  sign_in: vi.fn(),
  sign_out: vi.fn(),
  create_user: vi.fn(),
  delete_user: vi.fn(),
  on_auth_state_changed: callback => {
    // Store callback to allow triggering auth state changes
    auth._auth_state_callback = callback
    // Initial call with current state
    if (callback) callback(auth.current_user)
    // Return unsubscribe function
    return () => {
      auth._auth_state_callback = null
    }
  },

  // Helper methods for tests
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

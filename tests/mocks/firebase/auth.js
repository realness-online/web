import { vi } from 'vitest'

const auth = {
  current_user: null,
  sign_in: vi.fn(),
  sign_out: vi.fn(),
  create_user: vi.fn(),
  delete_user: vi.fn(),
  on_auth_state_changed:
    _callback =>
    // Implementation if needed
    () => {}
}

export default auth

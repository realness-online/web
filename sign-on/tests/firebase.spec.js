import { beforeEach as before_each, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  getAuth: vi.fn(),
  initializeApp: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('firebase/app', () => ({ initializeApp: mocks.initializeApp }))
vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: vi.fn(),
  getAuth: mocks.getAuth,
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithPhoneNumber: mocks.signInWithPhoneNumber,
  signOut: mocks.signOut
}))

import { auth, init_auth, sign_in, sign_off } from '@/utils/firebase'

before_each(() => {
  vi.clearAllMocks()
  mocks.getAuth.mockReturnValue(mocks.auth)
  init_auth()
})

describe('firebase utils', () => {
  /* The modular API takes the auth instance first. Dropping it sends the
     phone number into the auth slot, and the real SDK throws inside
     _verifyPhoneNumber with "._getRecaptchaConfig is not a function". */
  it('binds this page auth into sign_in', async () => {
    const verifier = { type: 'recaptcha' }
    await sign_in('+15555550101', verifier)

    expect(mocks.signInWithPhoneNumber).toHaveBeenCalledWith(auth.value, '+15555550101', verifier)
  })

  it('signs off the same instance', async () => {
    await sign_off()

    expect(mocks.signOut).toHaveBeenCalledWith(auth.value)
  })
})

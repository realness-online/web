/** @typedef {import('@/types').Item} Item */

const is_browser =
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

/** Default profile shell before network load (kept out of composables to avoid import cycles). */
export const default_person = {
  id: is_browser ? localStorage.me : null,
  type: 'person'
}

/** Firebase Storage prefix name → author id */
export const from_e64 = e64_number => `/${e64_number}`

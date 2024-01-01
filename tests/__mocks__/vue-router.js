export const useRouter = vi.fn(() => {
  return {
    push: vi.fn()
  }
})
export const useRoute = vi.fn(() => {
  return {
    params: {
      phone_number: '+14156732435',
      type: 'posters',
      id: '559666932867'
    }
  }
})

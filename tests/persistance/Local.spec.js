import Storage from '@/persistance/Storage'
import Local from '@/persistance/Local'
import fs from 'fs'
const preferences = fs.readFileSync(
  './__mocks__/html/preferences.html',
  'utf8'
)
describe('@/persistance/Local.js', () => {
  class Preferences extends Local(Storage) {}
  let local
  beforeEach(() => {
    local = new Preferences('/+16282281824/preferences')
  })
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })
  describe('Methods', () => {
    describe('#save', () => {
      it('Exists', () => {
        expect(local.save).toBeDefined()
      })
      it('Saves items locally', async () => {
        await local.save({ outerHTML: preferences })
        expect(localStorage.setItem).toBeCalled()
      })
      it('Only saves if there are items to save', () => {
        local.save()
        expect(localStorage.setItem).not.toBeCalled()
      })
    })
  })
})

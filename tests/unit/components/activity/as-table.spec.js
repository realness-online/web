import { shallow } from 'vue-test-utils'
import table from '@/components/activity/as-table'
describe('@/components/activity/as-table.js', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(table)
  })
  afterEach(() => {
    sessionStorage.clear()
  })
  it('a table of activity ', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('methods', () => {
    describe('#info_logger', () => {
      it('adds an acitvity to the logger', async () => {
        await wrapper.vm.info_logger()
      })
    })
    describe('#one_second_ago', () => {
      it('adds an acitvity to the logger', async () => {
        wrapper.vm.one_second_ago()
      })
    })
    describe('#on_error', () => {
      it('is called when there is an error', async () => {
        wrapper.vm.on_error({})
      })
    })
  })

})

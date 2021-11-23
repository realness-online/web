import { shallowMount } from '@vue/test-utils'
import as_days from '@/components/as-days'
import get_item from '@/modules/item'
import * as as_date from '@/helpers/date'
import * as sorting from '@/helpers/sorting'
const fs = require('fs')
const statements_html = fs.readFileSync(
  './tests/unit/html/statements.html',
  'utf8'
)
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const statements = get_item(statements_html).statements
describe('@/components/as-days', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_days)
  })
  describe('Renders', () => {
    it('With nothing', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('With posters and statements sorted into the days they were created', async () => {
      await wrapper.setProps({ statements, posters: [poster] })
      expect(wrapper.element).toMatchSnapshot()
      expect([...wrapper.vm.days.entries()].length).toBe(4)
    })
  })
  describe('Methods', () => {
    describe('#insert_into_day', () => {
      let other_poster
      beforeEach(() => {
        other_poster = { ...poster }
        other_poster.id = '/+16282281824/posters/559666932000'
      })
      it('Adds poster to the same day', async () => {
        jest.spyOn(sorting, 'earlier_weirdo_first')
        await wrapper.setProps({ statements, posters: [poster, other_poster] })
        expect(wrapper.vm.days.get('9/26/1987').length).toBe(2)
        expect(sorting.earlier_weirdo_first).toBeCalled()
      })
      it('Sorts todays items by most recent', async () => {
        jest.spyOn(as_date, 'is_today').mockImplementation(() => true)
        jest.spyOn(sorting, 'recent_weirdo_first')
        await wrapper.setProps({ statements, posters: [poster, other_poster] })
        expect(sorting.recent_weirdo_first).toBeCalled()
      })
    })
    describe('#check_intersection', () => {
      it('waits for day to intersect', () => {
        wrapper.vm.check_intersection([{ isIntersecting: false }])
      })
      it('Increases the number of visible days', () => {
        expect(wrapper.vm.page).toBe(1)
        wrapper.vm.days = new Set()
        for (let i = 0; i < 6; i++) {
          wrapper.vm.days.add([])
        }
        wrapper.vm.check_intersection([{ isIntersecting: true }])
        expect(wrapper.vm.page).toBe(2)
      })
      it('Paginates when there are more then 5 days', () => {
        expect(wrapper.vm.page).toBe(1)
        wrapper.vm.days = new Set()
        wrapper.vm.check_intersection([{ isIntersecting: true }])
        expect(wrapper.vm.page).toBe(1)
      })
    })
  })
})

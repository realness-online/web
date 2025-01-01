import { mount, shallowMount } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import { get } from 'idb-keyval'
import { Poster } from '@/persistance/Storage'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const poster_html = read_mock_file('@@/html/poster.html')
const poster = get_item(poster_html)

describe('@/views/Posters', () => {
  let wrapper
  const mock_date = new Date(2020, 1, 1)

  beforeEach(() => {
    wrapper = shallowMount(Posters)
  })

  describe('Renders', () => {
    it('renders posters view', async () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Methods', () => {
    describe('#load_posters', () => {
      it('loads posters from storage', async () => {
        await wrapper.vm.load_posters()
        expect(wrapper.vm.posters).toEqual([])
      })
    })

    describe('#save_poster', () => {
      it('saves poster to storage', async () => {
        await wrapper.vm.save_poster(poster)
        expect(wrapper.vm.posters).toContain(poster)
      })
    })

    describe('#remove_poster', () => {
      it('removes poster from storage', async () => {
        wrapper.vm.posters = [poster]
        await wrapper.vm.remove_poster(poster)
        expect(wrapper.vm.posters).not.toContain(poster)
      })
    })

    describe('#update_poster', () => {
      it('updates existing poster', async () => {
        const updated_poster = { ...poster, title: 'Updated Title' }
        wrapper.vm.posters = [poster]
        await wrapper.vm.update_poster(updated_poster)
        expect(wrapper.vm.posters[0].title).toBe('Updated Title')
      })
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import People from '@/use/people'

const MOCK_ITEM_ID = 'test-123'
const PEOPLE_COUNT = 3

describe('@/use/people', () => {
  let wrapper
  let load_spy

  beforeEach(() => {
    load_spy = vi.fn()
    wrapper = shallowMount(People, {
      global: {
        mocks: {
          load_people: load_spy
        }
      }
    })
  })

  describe('Basic Functionality', () => {
    it('initializes with empty people list', () => {
      expect(wrapper.vm.people).toEqual([])
    })

    it('adds new people', () => {
      const test_people = Array(PEOPLE_COUNT).fill().map((_, i) => ({
        id: `person-${i}`,
        name: `Person ${i}`
      }))

      test_people.forEach(person => {
        wrapper.vm.add_person(person)
      })

      expect(wrapper.vm.people.length).toBe(PEOPLE_COUNT)
    })
  })

  describe('People Loading', () => {
    it('loads people data', async () => {
      const mock_people = [{ id: MOCK_ITEM_ID, name: 'Test Person' }]
      load_spy.mockResolvedValueOnce(mock_people)

      await wrapper.vm.load_people(MOCK_ITEM_ID)
      expect(load_spy).toHaveBeenCalledWith(MOCK_ITEM_ID)
      expect(wrapper.vm.people).toEqual(mock_people)
    })

    it('handles loading errors', async () => {
      load_spy.mockRejectedValueOnce(new Error('Load failed'))
      await wrapper.vm.load_people(MOCK_ITEM_ID)
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('People Management', () => {
    it('removes people', () => {
      const person = { id: MOCK_ITEM_ID, name: 'Test Person' }
      wrapper.vm.add_person(person)
      wrapper.vm.remove_person(person)
      expect(wrapper.vm.people).not.toContain(person)
    })

    it('updates existing people', () => {
      const person = { id: MOCK_ITEM_ID, name: 'Original Name' }
      const updated = { id: MOCK_ITEM_ID, name: 'Updated Name' }
      wrapper.vm.add_person(person)
      wrapper.vm.update_person(updated)
      expect(wrapper.vm.people[0].name).toBe('Updated Name')
    })
  })
})

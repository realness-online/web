import profile from '@/helpers/profile'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe('@/helpers/profile', () => {
  it('#load', async () => {
    fetch.mockResponseOnce(person)
    const katie = await profile.load('/+16282281824')
    await flushPromises()
    expect(katie.first_name).toBe('katie')
    expect(fetch).toBeCalled()
  })
})

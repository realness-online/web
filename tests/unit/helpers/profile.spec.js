import profile from '@/helpers/profile'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
describe('@/helpers/profile', () => {
  it('#load', async() => {
    fetch.mockResponseOnce(person)
    const katie = await profile.load('/+16282281824')
    await flushPromises()
    expect(katie.first_name).toBe('katie')
    expect(fetch).toBeCalled()
  })
  it('#items', async() => {
    fetch.mockResponseOnce(posts)
    const items = await profile.items('+14151231234', 'posts')
    await flushPromises()
    expect(items.length).toEqual(9)
    expect(fetch).toBeCalled()
  })
})

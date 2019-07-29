import profile_id from '@/modules/profile_id'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
import flushPromises from 'flush-promises'
describe('@/modules/profile_id', () => {
  it('#load', async() => {
    fetch.mockResponseOnce(person)
    const katie = await profile_id.load('/+16282281824')
    await flushPromises()
    expect(katie.first_name).toBe('katie')
    expect(fetch).toBeCalled()
  })
  it('#items', async() => {
    fetch.mockResponseOnce(posts)
    const items = await profile_id.items('+14151231234', 'posts')
    await flushPromises()
    expect(items.length).toEqual(54)
    expect(fetch).toBeCalled()
  })
})

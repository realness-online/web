// import { shallow } from 'vue-test-utils'
// import load_mobile_item from '@/modules/mobile_as_item'
//
// const posts_as_text = `
// <div itemprop="posts" itemref="profile">
//   <article itemscope="itemscope" itemtype="/post">
//     <blockquote itemprop="articleBody">I just called the cat 'dick nose'</blockquote>
//     <time itemprop="created_at" datetime="2018-11-26T17:41:14.215Z">calculating...</time>
//   </article>
//   <article itemscope="itemscope" itemtype="/post">
//     <blockquote itemprop="articleBody">Someone who will never admit they are wrong is a fool on repeat</blockquote>
//     <time itemprop="created_at" datetime="2018-11-30T01:36:12.166Z">calculating...</time>
//   </article>
//   <article itemscope="itemscope" itemtype="/post">
//     <blockquote itemprop="articleBody">Zoom in in that mother fuckers! Someone got his money clip back</blockquote>
//     <time itemprop="created_at" datetime="2018-11-30T22:04:15.284Z">calculating...</time>
//   </article>
//   <article itemscope="itemscope" itemtype="/post">
//     <blockquote itemprop="articleBody">I know of a room for seven fifty. Looking to move in now</blockquote>
//     <time itemprop="created_at" datetime="2018-11-30T22:18:03.090Z">calculating...</time>
//   </article>
// </div>
// `
// describe("@/mixins/load_mobile_item", () => {
//   it('#get_items', () => {
//     fetch.mockResponseOnce(posts_as_text)
//     load_mobile_item.methods.get_items_from_mobile('4151231234', 'posts').then(items => {
//       expect(items.length).toEqual(4)
//       expect(fetch).toBeCalled()
//     })
//   })
//   it('#get_item_id', () => {
//     const person = {
//       mobile: '4151236787'
//     }
//     expect(load_mobile_item.methods.get_item_id(person)).toBe('/+14151236787')
//   })
// })

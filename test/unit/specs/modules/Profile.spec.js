import { shallow } from 'vue-test-utils'
import profile from '@/modules/Profile'

const posts_as_text = `
<div itemprop="posts" itemref="profile">
  <article itemscope="itemscope" itemtype="/post">
    <blockquote itemprop="articleBody">I just called the cat 'dick nose'</blockquote>
    <time itemprop="created_at" datetime="2018-11-26T17:41:14.215Z">calculating...</time>
  </article>
  <article itemscope="itemscope" itemtype="/post">
    <blockquote itemprop="articleBody">Someone who will never admit they are wrong is a fool on repeat</blockquote>
    <time itemprop="created_at" datetime="2018-11-30T01:36:12.166Z">calculating...</time>
  </article>
  <article itemscope="itemscope" itemtype="/post">
    <blockquote itemprop="articleBody">Zoom in in that mother fuckers! Someone got his money clip back</blockquote>
    <time itemprop="created_at" datetime="2018-11-30T22:04:15.284Z">calculating...</time>
  </article>
  <article itemscope="itemscope" itemtype="/post">
    <blockquote itemprop="articleBody">I know of a room for seven fifty. Looking to move in now</blockquote>
    <time itemprop="created_at" datetime="2018-11-30T22:18:03.090Z">calculating...</time>
  </article>
</div>
`
const profile_as_text = `
<figure class="profile" itemid="/+16282281824" itemscope="itemscope" itemtype="/person">
  <svg>
    <defs itemprop="avatar"/><use xlink:href="#silhouette"/>
  </svg>
  <figcaption>
    <p>
      <span itemprop="first_name">katie</span>
      <span itemprop="last_name">caffey</span>
    </p>
    <a data-value="6282281824" href="sms:+16282281824" itemprop="mobile">(628) 228-1824</a>
  </figcaption>
</figure>
`
describe("@/mixins/Profile", () => {
  it('items()', () => {
    fetch.mockResponseOnce(posts_as_text)
    profile.items('+14151231234', 'posts').then(items => {
      expect(items.length).toEqual(4)
      expect(fetch).toBeCalled()
    })
  })
  it('load()', () => {
    fetch.mockResponseOnce(profile_as_text)
    const katie = profile.load('/+16282281824').then(katie => {
      expect(katie.first_name).toBe('katie')
      expect(fetch).toBeCalled()
    })
  })
})

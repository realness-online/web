<template>
  <section id="feed" class="page">
    <header>
      <icon name='nothing'></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Feed</h1>
    </hgroup>
    <profile-as-list :people='relations'></profile-as-list>
    <icon v-if="working" name="working"></icon>
    <section v-else class="day" v-for="[date, day] in days">
      <header>
        <h4>{{date}}</h4>
      </header>
      <post-as-article v-for="post in day" :post="post"></post-as-article>
    </section>
  </section>
</template>
<script>
  import { relations_storage, person_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import posts_into_days from '@/mixins/posts_into_days'
  import post_as_article from '@/components/posts/as-article'
  import icon from '@/components/icon'
  export default {
    mixins: [posts_into_days],
    components: {
      'profile-as-avatar': profile_as_avatar,
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link,
      'post-as-article': post_as_article,
      icon
    },
    data() {
      return {
        feed: [],
        days: null,
        relations: [],
        working: true,
        feed_limit: 8
      }
    },
    async created() {
      console.time('feed-load')
      const people_in_feed = relations_storage.as_list()
      const me = await person_storage.as_object()
      people_in_feed.push(me)
      const feed = await this.populate_feed(people_in_feed)
      feed.sort(this.later_first)
      this.feed = this.condense_posts(feed)
      this.days = this.posts_into_days(this.size_limited_feed)
      this.working = false
      console.info(`${this.sort_count} sort operations`)
      console.timeEnd('feed-load')
    },
    methods: {
      async populate_feed(people_in_feed) {
        console.time('populate-feed')
        const feed = []
        await Promise.all(people_in_feed.map(async (relation) => {
          // const person = await profile_id.load(relation.id)
          // const posts = await profile_id.items(relation.id, 'posts')
          const [person, posts] = await Promise.all([
            profile_id.load(relation.id),
            profile_id.items(relation.id, 'posts')
          ])
          this.relations.push(person)
          posts.forEach(post => {
            if (!post.muted) {
              post.person = person
              if (person.oldest_post < post.created_at) {
                person.oldest_post = post.created_at
              }
              feed.push(post)
            }
          })
        }))
        console.timeEnd('populate-feed')
        return feed
      }
    },
    computed: {
      size_limited_feed() {
        return this.feed_limit ? this.feed.slice(0, this.feed_limit) : this.feed
      }
    }
  }
</script>
<style lang="stylus">
  section#feed
    position: relative
    max-width: page-width
    display: flex
    flex-direction: column
    & > header > svg
      fill: transparent
    & > nav
      display: none
    & > hgroup > h1
      margin-bottom: 0
    & > svg.working
      order: 1
      margin: base-line auto
    & > section
      padding: 0 base-line
      & > header > h4
        font-weight: 200
      &:first-of-type > header > h4
        margin-top: base-line
      & > article
        overflow: hidden
        margin-bottom: base-line
        &:last-of-type
          margin-bottom: 0
        & > hgroup
          font-weight: 200
          & > span
          & > time
            display: inline-block
            vertical-align: center
          & > span
            color: black
          & > time
            color: black
            margin-left: (base-line / 6)
        & > blockquote
          margin-bottom: base-line
          &:last-of-type
            margin-bottom: 0
        & > a > svg
          float: left
          margin-right: base-line
          shape-outside: circle()
          clip-path: circle(44%)
          fill: blue
          stroke: lighten(blue, 33%)
          stroke-width: 2px
</style>

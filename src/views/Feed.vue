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
    <section v-else class="day" :key="date" v-for="[date, day] in days">
      <header>
        <h4>{{date}}</h4>
      </header>
      <post-as-article v-for="post in day" :post="post" :key="post_id(post)" v-on:next-page="next_page"></post-as-article>
    </section>
  </section>
</template>
<script>
  import { relations_local, person_local } from '@/modules/LocalStorage'
  import profile_id from '@/modules/profile_id'
  import growth from '@/modules/growth'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import posts_into_days from '@/mixins/posts_into_days'
  import post_as_article from '@/components/posts/as-article'
  import icon from '@/components/icon'
  export default {
    mixins: [posts_into_days],
    components: {
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
      // console.clear()
      // console.time('feed-load')
      const people_in_feed = relations_local.as_list()
      const me = person_local.as_object()
      people_in_feed.push(me)
      await this.populate_feed(people_in_feed)
      this.sort_feed_into_days()
      this.working = false
      // console.info(`${this.sort_count} sort operations`)
      // console.timeEnd('feed-load')
    },
    methods: {
      async populate_feed(people_in_feed) {
        await Promise.all(people_in_feed.map(async (relation) => {
          const [person, posts] = await Promise.all([
            profile_id.load(relation.id),
            profile_id.items(relation.id, 'posts')
          ])
          this.relations.push(person)
          posts.map(post => this.add_post_to_feed(person, post))
        }))
      },
      sort_feed_into_days() {
        this.feed.sort(this.later_first)
        this.feed = this.condense_posts(this.feed)
        this.days = this.posts_into_days(this.feed)
      },
      add_post_to_feed(person, post) {
        // console.log(post);
        if (!post.muted) {
          post.person = person
          const current = person.oldest_post
          const maybe = post.created_at
          if (!current || maybe < current) person.oldest_post = maybe
          this.feed.push(post)
        }
      },
      async next_page(person) {
        console.log('next_page', person)
        if (person.page) person.page = growth.next(person.page)
        else person.page = growth.first()
        const next_page = `posts.${person.page}`
        const posts = await profile_id.items(person.id, next_page)
        posts.forEach(post => this.add_post_to_feed(person, post))
        this.feed_into_days()
      },
      post_id(post) {
        return `${post.person.id}/${post.created_at}`
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
</style>

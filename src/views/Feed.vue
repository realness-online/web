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
      <feed-as-article v-for="post in day"
        :post="post"
        :key="as_id(post)"
        v-on:next-page="next_page">
      </feed-as-article>
    </section>
  </section>
</template>
<script>
  import { relations_local, person_local } from '@/modules/LocalStorage'
  import profile_id from '@/helpers/profile'
  import growth from '@/modules/growth'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import posts_into_days from '@/mixins/posts_into_days'
  import date_formating from '@/mixins/date_formating'
  import feed_as_article from '@/components/feed/as-article'
  import icon from '@/components/icon'
  export default {
    mixins: [date_formating, posts_into_days],
    components: {
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link,
      'feed-as-article': feed_as_article,
      icon
    },
    data() {
      return {
        posts: [],
        relations: [],
        feed_limit: 8,
        chronological: false,
        working: true
      }
    },
    async created() {
      console.clear()
      console.time('feed-load')
      const people_in_feed = relations_local.as_list()
      const me = person_local.as_object()
      people_in_feed.push(me)
      await this.get_first_posts(people_in_feed)
      this.working = false
      console.info(`${this.sort_count} sort operations`)
      console.timeEnd('feed-load')
    },
    methods: {
      as_id(post) {
        return `${post.person.id}/${post.created_at}`
      },
      async get_first_posts(people_in_feed) {
        await Promise.all(people_in_feed.map(async (relation) => {
          const [person, posts] = await Promise.all([
            profile_id.load(relation.id),
            profile_id.items(relation.id, 'posts')
          ])
          this.relations.push(person)
          posts.map(post => this.add_person_to_post(person, post))
          this.posts = [...posts, ...this.posts]
        }))
        this.posts_into_days()
      },
      async next_page(person) {
        if (person.page) person.page = growth.next(person.page)
        else person.page = growth.first()
        const next_page = `posts.${person.page}`
        const posts = await profile_id.items(person.id, next_page)
        posts.forEach(post => this.add_person_to_post(person, post))
        console.assert(this.posts.length === 0, 'posts should be zero', this.posts.length)
        this.posts = [...posts, ...this.posts]
        this.posts_into_days()
      }
    }
    // watch: {
    //   posts() {
    //     console.log('watch posts triggered', this.sort_count)
    //     this.posts_into_days()
    //   }
    // }
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

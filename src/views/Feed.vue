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
        <h4>{{as_day(date)}}</h4>
      </header>
      <feed-as-article v-for="post in day"
        :post="post"
        :person="post.person"
        :key="post.id"
        @end-of-articles="next_page">
      </feed-as-article>
    </section>
  </section>
</template>
<script>
  import { relations_local, person_local } from '@/modules/LocalStorage'
  import profile from '@/helpers/profile'
  import growth from '@/modules/growth'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import date_mixin from '@/mixins/date'
  import feed_as_article from '@/components/feed/as-article'
  import icon from '@/components/icon'
  export default {
    mixins: [date_mixin, posts_into_days, condense_posts],
    components: {
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link,
      'feed-as-article': feed_as_article,
      icon
    },
    data() {
      return {
        days: new Map(),
        relations: [],
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
      async get_first_posts(people_in_feed) {
        let everyones_posts = []
        await Promise.all(people_in_feed.map(async (relation) => {
          const [person, posts] = await Promise.all([
            profile.load(relation.id),
            profile.items(relation.id, 'posts')
          ])
          this.relations.push(person)
          everyones_posts = [...everyones_posts, ...this.condense_posts(posts, person)]
        }))
        everyones_posts.sort(this.newer_first)
        everyones_posts.forEach(post => this.insert_post_into_day(post, this.days))
      },
      async next_page(person) {
        if (person.page) person.page = growth.next(person.page)
        else person.page = growth.first()
        console.log(`posts.${person.page}`, person.first_name)
        let posts = await profile.items(person.id, `posts.${person.page}`)
        posts = this.condense_posts(posts, person)
        posts.forEach(post => this.insert_post_into_day(post, this.days))
        const sorted =  [...this.days.entries()].sort(this.newer_day_first)
        this.days = new Map(sorted)
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

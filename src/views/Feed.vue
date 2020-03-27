<template>
  <section id="feed" class="page">
    <header>
      <icon name='nothing'></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Feed</h1>
    </hgroup>
    <icon v-if="working" name="working"></icon>
    <article v-else class="day" :key="date" v-for="[date, day] in days" :class="{today: is_today(date)}">
      <header>
        <h4>{{as_day(date)}}</h4>
      </header>
      <div v-for="post in day" :key="post.id">
        <poster-as-figure v-if="post.type === 'posters'" :poster="post"></poster-as-figure>
        <post-as-article v-else :post="post" :person="post.person" @end-of-articles="next_page"></post-as-article>
      </div>
    </article>
  </section>
</template>
<script>
  import { relations_storage, person_storage as me } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import itemid from '@/helpers/itemid'
  import growth from '@/modules/growth'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import post_as_article from '@/components/feed/as-article'
  import poster_as_figure from '@/components/feed/as-figure'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import posters_mixin from '@/mixins/posters'
  import signed_in from '@/mixins/signed_in'
  import date_mixin from '@/mixins/date'
  export default {
    mixins: [
      signed_in,
      date_mixin,
      condense_posts,
      posts_into_days,
      posters_mixin
    ],
    components: {
      'logo-as-link': logo_as_link,
      'post-as-article': post_as_article,
      'poster-as-figure': poster_as_figure,
      icon
    },
    data () {
      return {
        days: new Map(),
        relations: [],
        working: true
      }
    },
    async created () {
      console.clear()
      console.time('feed-load')
      const people_in_feed = relations_storage.as_list()
      people_in_feed.push(me.as_object())
      await this.get_first_posts(people_in_feed)
      this.working = false
      console.info(`Feed sorts ${this.sort_count} items for  ${me.as_object().first_name}`)
      console.timeEnd('feed-load')
    },
    methods: {
      async get_first_posts (people_in_feed) {
        let feed = []
        await Promise.all(people_in_feed.map(async (relation) => {
          const [person, posts, posters] = await Promise.all([
            profile.load(relation.id),
            itemid.load(`${relation.id}/posts/index`),
            profile.directory(relation.id, 'posters')
          ])
          this.relations.push(person)
          feed = [...this.condense_posts(posts, person),
                  ...this.prepare_posters(posters, person), ...feed]
        }))
        feed.sort(this.newer_first)
        feed.forEach(post => this.insert_post_into_day(post, this.days))
      },
      async next_page (person) {
        if (person.page) person.page = growth.next(person.page)
        else person.page = growth.first()
        console.info(`${me.first_name} loads`, `posts.${person.page}`, person.first_name)
        let posts = await itemid.load(`${person.id}/posts/${person.page}`)
        posts = this.condense_posts(posts, person)
        posts.forEach(post => this.insert_post_into_day(post, this.days))
        const sorted = [...this.days.entries()].sort(this.newer_day_first)
        this.days = new Map(sorted)
      }
    }
  }
</script>
<style lang="stylus">
  section#feed
    position: relative
    display: flex
    flex-direction: column
    @media (min-width: pad-begins)
      max-width: page-width
    & > header > svg
      fill: transparent
    & > div
      display: none
    & > nav
      display: none
    & > hgroup > h1
      margin-bottom: 0
    & > svg.working
      order: 1
      margin: base-line auto
    & > article.day
      padding: 0 base-line
      display:flex
      flex-direction: column
      &.today
        flex-direction: column-reverse
        & > header
          order: 1
      & > header > h4
        font-weight: 800
        margin-top: base-line
        margin-bottom: 0
      & > div
        & > figure > figcaption,
        & > article > header
          display: flex
          justify-content: flex-start
          flex-direction: row
          margin: base-line 0
          & a > svg
            cursor: pointer
            shape-outside: circle()
            border-radius: base-line
            margin-right: (base-line / 4)
          & > hgroup
            margin: 0
            & > span
              font-weight: 300
              display: inline-block
</style>

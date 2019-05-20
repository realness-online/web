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
    <section v-else class="day" v-for="day in days">

      <article v-for="post in day" :key="post.created_at" itemscope itemtype="/post">
        {{post}}
        <router-link :to="post.person.id">
          <profile-as-avatar :person="post.person" :by_reference="true"></profile-as-avatar>
        </router-link>
        <hgroup>
          <span>{{post.person.first_name}} {{post.person.last_name}}</span>
          <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
        </hgroup>
        <blockquote itemprop="statement" v-for="statement in post.statements" >{{statement.articleBody}}</blockquote>
        <blockquote itemprop="statement" >{{post.articleBody}}</blockquote>

      </article>
    </section>

  </section>
</template>
<script>
  import { relations_storage, person_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import icon from '@/components/icon'
  export default {
    components: {
      'profile-as-avatar': profile_as_avatar,
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link,
      icon
    },
    data() {
      return {
        thirteen_minutes: 1000 * 60 * 13,
        feed_limit: 13,
        feed: [],
        days: null,
        relations: [],
        working: true,
        relations_left: null,
        sort_count: 0
      }
    },
    beforeMount () {
      window.addEventListener('scroll', this.scrolled)
    },
    beforeDestroy () {
      window.removeEventListener('scroll', this.scrolled)
    },
    created() {
      console.clear()
      console.time('feed-load')
      const people_in_feed = relations_storage.as_list()
      const me = person_storage.as_object()
      people_in_feed.push(me)
      this.relations_left = people_in_feed.length
      this.populate_days(people_in_feed).then(days => {
        days.forEach(day => {
          this.sort_day(day)
          // this.condense_day(day)
        })

        this.working = false
        console.timeEnd('feed-load')
        console.log(`${this.feed.length} feed items`)
        console.info(`${this.sort_count} sort operations`)
      })
    },
    methods: {
      sort_day(day) {
        console.log('day', day)
        day.sort(this.feed_sorter)
      },
      condense_feed() {
        console.time('condense-feed')
        const condensed_feed = []
        while(this.feed.length > 0) {
          let post = this.feed.shift()
          post.statements = []
          while(this.is_train_of_thought(post)) {
            const next_statement = this.feed.shift()
            post.statements.unshift(next_statement)
          }
          condensed_feed.push(post)
        }
        this.feed = condensed_feed
        console.timeEnd('condense-feed')
      },
      is_train_of_thought(post) {
        this.sort_count++
        const next_post = this.feed[0]
        if (next_post && next_post.person.id === post.person.id) {
          let last_post = post
          if (post.statements.length > 0) {
            last_post = post.statements[0]
          }
          let difference = Date.parse(last_post.created_at) - Date.parse(next_post.created_at)
          if (difference < this.thirteen_minutes) {
            return true
          } else {
            return false
          }
        } else {
          return false
        }
      },
      feed_sorter(a, b) {
        this.sort_count++
        return Date.parse(b.created_at) - Date.parse(a.created_at)
      },
      scrolled(event) {
        const article = document.querySelector('#feed > article:last-of-type')
        const bottom = article.getBoundingClientRect().bottom - 560
        // console.log(bottom -window.scrollY)
        if (bottom < window.scrollY && this.feed.length > this.feed_limit) {
          this.feed_limit = this.feed_limit * 2
        }
      },
      populate_days(people_in_feed) {
        return new Promise((resolve, reject) => {
          const days = new Map()
          people_in_feed.forEach(relation => {
            profile_id.load(relation.id).then(person => {
              this.relations.push(person)
              profile_id.items(relation.id, 'posts').then(posts => {
                this.relations_left--
                console.log(person.first_name,'person.posts.length', posts.length)
                posts.forEach(post => {

                  post.person = person
                  if (!post.muted) {
                    const day = post.created_at.split('T')[0]

                    if (days.has(day)) {
                      const days_posts = days.get(day)
                      days_posts.push(post)
                    } else {
                      days.set(day, [post])
                    }
                  }
                })
                if (this.relations_left < 1) {
                  resolve(days)
                }
              })
            })
          })
        })
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
    & > nav.profile-list
      display: none
    & > svg.working
      order: 1
      margin-bottom: base-line
    & > article
      overflow: hidden
      padding: base-line base-line 0 base-line
      &:first-of-type
        padding-top: 0
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
        shape-outside: circle()
        margin-right: base-line
        float: left
        clip-path: circle(50%)
        fill: blue
        stroke: lighten(blue, 33%)
        stroke-width:2px
</style>

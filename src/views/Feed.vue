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
    <section v-else class="day" v-for="day in days">
      <header>
        <h3>{{day[0]}}</h3>
      </header>
      <article v-for="post in day[1]" :key="post.created_at" itemscope itemtype="/post" :itemid="item_id(post)">
        <router-link :to="post.person.id">
          <profile-as-avatar :person="post.person" :by_reference="true"></profile-as-avatar>
        </router-link>
        <hgroup>
          <span>{{post.person.first_name}} {{post.person.last_name}}</span>
          <time itemprop="created_at" :datetime="post.created_at">Calculating...</time>
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
        days: null,
        relations: [],
        working: true,
        relations_left: null,
        sort_count: 0
      }
    },
    beforeMount () {
      // window.addEventListener('scroll', this.scrolled)
    },
    beforeDestroy () {
      // window.removeEventListener('scroll', this.scrolled)
    },
    created() {
      console.clear()
      console.time('feed-load')
      const people_in_feed = relations_storage.as_list()
      const me = person_storage.as_object()
      people_in_feed.push(me)
      this.relations_left = people_in_feed.length
      this.populate_feed(people_in_feed).then(feed => {
        this.feed_length = feed.length
        feed.sort(this.later_first)
        feed = this.condense_feed(feed)
        this.days = this.feed_into_days(feed)
        this.working = false
        console.timeEnd('feed-load')
        console.info(`${this.feed_length} feed items`)
        console.info(`${this.sort_count} sort operations`)
      })
    },
    methods: {
      item_id(post){
        return `${post.person.id}/${post.created_at}`
      },
      condense_feed(feed) {
        console.time('condense-feed')
        const condensed_feed = []
        while(feed.length > 0) {
          let post = feed.shift()
          post.statements = []
          while(this.is_train_of_thought(post, feed)) {
            const next_statement = feed.shift()
            post.statements.unshift(next_statement)
          }
          condensed_feed.push(post)
        }
        console.timeEnd('condense-feed')
        return condensed_feed
      },
      is_train_of_thought(post, feed) {
        this.sort_count++
        const next_post = feed[0]
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
      earlier_first(earlier, later) {
        this.sort_count++
        return Date.parse(earlier.created_at) - Date.parse(later.created_at)
      },
      later_first(earlier, later) {
        this.sort_count++
        return Date.parse(later.created_at) - Date.parse(earlier.created_at)
      },
      scrolled(event) {
        const article = document.querySelector('#feed > article:last-of-type')
        const bottom = article.getBoundingClientRect().bottom - 560
        // console.log(bottom -window.scrollY)
        if (bottom < window.scrollY && this.feed.length > this.feed_limit) {
          this.feed_limit = this.feed_limit * 2
        }
      },
      populate_feed(people_in_feed) {
        return new Promise((resolve, reject) => {
          const feed = []
          people_in_feed.forEach(relation => {
            profile_id.load(relation.id).then(person => {
              this.relations.push(person)
              profile_id.items(relation.id, 'posts').then(posts => {
                this.relations_left--
                posts.forEach(post => {
                  if (!post.muted) {
                    post.person = person
                    feed.push(post)
                  }
                })
                if (this.relations_left < 1) {
                  resolve(feed)
                }
              })
            })
          })
        })
      },
      feed_into_days(feed) {
        const days = new Map()
        feed.forEach(post => {
          const created_time = new Date(post.created_at)
          // const created_day =

          const format = {weekday:'long', day:'numeric', month:'long'}
          const today = "Today"
          let day = created_time.toLocaleString('en-US', format)

          if (created_time.toDateString()  === (new Date()).toDateString() ) {
            day = today
          }
          if (days.has(day)) {
            if (day === today) {
              days.get(today).push(post)
            } else {
              days.get(day).unshift(post)
            }
          } else {
            days.set(day, [post])
          }
        })
        return days
      }
    },
    computed: {
      ordered_days() {
        const ordered_keys = this.days.keys().sort(this.day_sorter)
        const days_as_list = []
        ordered_keys.forEach(day => {
          days_as_list.push(this.days.get(day))
        })
        return days_as_list
      },
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
      margin-bottom: base-line

    & > section
      & > header > h3
        font-weight: 100
      &:first-of-type > header > h3
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
          shape-outside: circle()
          margin-right: base-line
          float: left
          clip-path: circle(50%)
          fill: blue
          stroke: lighten(blue, 33%)
          stroke-width:2px
</style>

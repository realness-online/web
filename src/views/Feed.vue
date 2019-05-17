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
    <article v-else v-for="post in size_limited_feed" :key="post.id" itemscope itemtype="/post">
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
        relations: [],
        working: true,
        unpopulated_relations_count: null,
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
      console.time('feed_load')
      const people_in_feed = relations_storage.as_list()
      const me = person_storage.as_object()
      people_in_feed.push(me)
      this.unpopulated_relations_count = people_in_feed.length
      this.populate_feed(people_in_feed).then(() => {
        this.feed.sort(this.feed_sorter)
        this.condense_feed()
        this.working = false
        console.timeEnd('feed_load')
        console.log(`${this.feed.length} feed items`);
        console.info(`${this.sort_count} sort operations`)
      })
    },
    methods: {
      condense_feed() {
        console.time('condense_feed')
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
        console.timeEnd('condense_feed')
      },
      is_train_of_thought(post) {
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
      populate_feed(people_in_feed) {
        return new Promise((resolve, reject) => {
          console.time('populate_feed')
          people_in_feed.forEach((relation, index) => {
            profile_id.load(relation.id).then(person => {
              this.relations.push(person)
              profile_id.items(relation.id, 'posts').then(posts => {
                this.unpopulated_relations_count--
                posts.forEach(post => {
                  post.person = person
                })
                this.feed.push(...posts)
                if (this.unpopulated_relations_count < 1) {
                  console.timeEnd('populate_feed')
                  resolve('finished')
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
          // font-size: 0.75em
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

<template>
  <section id="feed" class="page left">
    <header>
      <icon name='nothing'></icon>
      <h1>Feed</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list :people='relations'></profile-as-list>
    <icon v-if="working" name="working"></icon>
    <article v-else v-for="post in size_limited_feed" itemscope itemtype="/post" >
      <header>
        <profile-as-figure :person='post.person' :avatar_by_reference="true"></profile-as-figure>
      </header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
    </article>
  </section>
</template>
<script>
  import { relations_storage, posts_storage, person_storage } from '@/modules/Storage'
  import logoAsLink from '@/components/logo-as-link'
  import profileAsList from '@/components/profile/as-list'
  import profileAsFigure from '@/components/profile/as-figure'
  import icon from '@/components/icon'
  import profile_id from '@/modules/profile_id'
  export default {
    components: {
      profileAsFigure,
      profileAsList,
      logoAsLink,
      icon
    },
    data() {
      return {
        feed_limit: 13,
        feed: [],
        relations: [],
        working: true,
        unsorted_relations: null,
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
      // console.clear()
      // console.time('feed_load')
      const people_in_feed = relations_storage.as_list()
      const me = person_storage.as_object()
      people_in_feed.push(me)
      this.unsorted_relations = people_in_feed.length
      this.populate_feed(people_in_feed).then(() => {
        this.feed.sort((a, b) => {
          this.sort_count++
          return Date.parse(b.created_at) - Date.parse(a.created_at)
        })
        this.working = false
        // console.timeEnd('feed_load')
        // console.log(`${this.feed.length} feed items`);
        // console.info(`${this.sort_count} sort operations`)
      })
    },
    methods: {
      scrolled(o)  {
        const bottom = document.querySelector('#feed > article:last-of-type')
          .getBoundingClientRect()
          .bottom
        if (bottom < window.scrollY && this.feed.length > this.feed_limit) {
          this.feed_limit = this.feed_limit * 2
        }
      },
      populate_feed(people_in_feed) {
        return new Promise((resolve, reject) => {
          people_in_feed.forEach((relation, index) => {
            profile_id.load(relation.id).then(person => {
              this.relations.push(person)
              profile_id.items(relation.id, 'posts').then(posts => {
                this.unsorted_relations--
                posts.forEach(post => {
                  post.person = person
                })
                this.feed.push(...posts)
                if(this.unsorted_relations < 1) {
                  resolve('finished')
                }
              })
            })
          })
        })
      }
    },
    computed:{
      size_limited_feed(){
        return this.feed_limit ? this.feed.slice(0, this.feed_limit) : this.feed
      }
    }
  }
</script>
<style lang="stylus">
  section#feed
    display: flex
    flex-direction: column
    & > nav.profile-list
      display:none
    & > header
      margin-bottom: base-line
      & > svg
        fill: transparent
    & > svg.working
      order: 1
      margin-bottom: base-line
    & > article
      margin-bottom: base-line
      & > header
        margin-bottom: (base-line / 2)
        & > figure > svg
          border-color: blue
          fill: blue
          stroke: lighten(blue, 33%)
</style>

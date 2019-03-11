<template>
  <section id="feed" class="page left" @:scroll.passive="scrolled">
    <header>
      <icon name='nothing'></icon>
      <h1>Feed</h1>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <profile-as-list :people='relations'></profile-as-list>
    <article v-if="!working" v-for="post in size_limited_feed" itemscope itemtype="/post" >
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
  import profile from '@/modules/Profile'
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
        unsorted_relations: null
      }
    },
    beforeMount () {
      window.addEventListener('scroll', this.scrolled)
    },
    beforeDestroy () {
      window.removeEventListener('scroll', this.scrolled)
    },
    created() {
      const people_in_feed = relations_storage.as_list()
      this.unsorted_relations = people_in_feed.length
      this.add_relations_to_feed(people_in_feed)
      this.insert_me_into_feed()
    },
    methods: {
      scrolled(o)  {
        const last_article = document.querySelector('#feed > article:last-of-type')
        const bottom = last_article.getBoundingClientRect().bottom
        if (bottom < window.scrollY && this.feed.length > this.feed_limit) {
          this.feed_limit = this.feed_limit * 2
        }
      },
      insert_me_into_feed() {
        const me = person_storage.as_object()
        let my_posts = posts_storage.as_list()
        this.relations.push(me)
        my_posts.forEach(post => (post.person = me))
        this.feed.push(...my_posts)
      },
      add_relations_to_feed(people_in_feed) {
        return new Promise((resolve, reject) => {
          people_in_feed.forEach((relation, index) => {
            profile.load(relation.id).then(person => {
              this.relations.push(person)
              // console.log(`getting posts for ${relation.id}`);
              profile.items(relation.id, 'posts').then(posts => {
                // console.log(this.unsorted_relations)
                this.unsorted_relations--
                posts.forEach(post => {
                  post.person = person
                })
                this.feed.push(...posts)
                this.feed.sort((a, b) => {
                  return Date.parse(b.created_at) - Date.parse(a.created_at)
                })
                if(this.unsorted_relations < 1) {
                  this.working = false
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
  @require '../style/variables'
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

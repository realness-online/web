<template>
  <section id="feed" class="page left">
    <header>
      <icon name="hamburger"></icon>
      <h1>Feed</h1>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <article v-if="!working" v-for="post in feed" itemscope itemtype="/post">
      <header>
        <profile-as-figure :person='post.person'></profile-as-figure>
      </header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
    </article>
  </section>
</template>
<script>
  import { relations_storage, posts_storage, person_storage } from '@/modules/Storage'
  import logoAsLink from '@/components/logo-as-link'
  import profileAsFigure from '@/components/profile/as-figure'
  import icon from '@/components/icon'
  import profile from '@/modules/Profile'
  export default {
    components: {
      profileAsFigure,
      logoAsLink,
      icon
    },
    data() {
      return {
        feed: [],
        working: true
      }
    },
    created() {
      this.insert_me_into_my_posts()
      this.add_relations_to_feed()
    },
    methods: {
      insert_me_into_my_posts() {
        const me = person_storage.as_object()
        let my_posts = posts_storage.as_list()
        my_posts.forEach(post => (post.person = me))
        this.feed.push(...my_posts)
      },
      add_relations_to_feed() {
        return new Promise((resolve, reject) => {
          relations_storage.as_list().forEach((relation, index) => {
            profile.load(relation.id).then(person => {
              profile.items(relation.id, 'posts').then(posts => {
                posts.forEach(post => {
                  post.person = person
                })
                this.feed.push(...posts)
                this.feed.sort((a, b) => {
                  return Date.parse(a.created_at) - Date.parse(b.created_at)
                })
                this.working = false
                resolve('finished')
              })
            })
          })
        })
      }
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  section#feed
    display: flex
    flex-direction: column-reverse
    & > header
      order: 2
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

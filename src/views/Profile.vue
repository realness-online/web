’<template lang="html">
  <section id="profile" class="page" ref='profile'>
    <header>
      <svg></svg>
      <logo-as-link></logo-as-link>
    </header>
    <avatar @loaded="avatar_loaded" :person="person"></avatar>
    <menu v-if="avatar">
      <download-vector :vector="avatar"></download-vector>
    </menu>
    <profile-as-figure :person='person'></profile-as-figure>
    <div v-for="[page_name, days] in pages" :key="page_name">
      <section class="day" v-for="[date, day] in days" :key="date" :class="{today: is_today(date)}">
        <header><h4>{{as_day(date)}}</h4></header>
        <div v-for="post in day" :key="post.id">
          <poster-as-figure v-if="post.type === 'posters'"
                            :poster="post">
          </poster-as-figure>
          <post-as-article v-else
                           :post="post"
                           :person="post.person"
                           @end-of-articles="next_page">
          </post-as-article>
        </div>
      </section>
    </div>
  </section>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import date_mixin from '@/mixins/date'
  import condense_posts from '@/mixins/condense_posts'
  import signed_in from '@/mixins/signed_in'
  import posters_mixin from '@/mixins/posters'
  import profile from '@/helpers/profile'
  import growth from '@/modules/growth'
  import logo_as_link from '@/components/logo-as-link'
  import download_vector from '@/components/download-vector'
  import profile_as_figure from '@/components/profile/as-figure'
  import avatar from '@/components/avatars/as-svg'
  import as_article from '@/components/posts/as-article'
  import poster_as_figure from '@/components/feed/as-figure'
  export default {
    mixins: [
      signed_in,
      date_mixin,
      posters_mixin,
      condense_posts,
      posts_into_days
    ],
    components: {
      avatar: avatar,
      'profile-as-figure': profile_as_figure,
      'download-vector': download_vector,
      'logo-as-link': logo_as_link,
      'poster-as-figure': poster_as_figure,
      'post-as-article': as_article
    },
    data() {
      return {
        pages: new Map(),
        limit: null,
        working: true,
        person: {},
        avatar: null
      }
    },
    async created() {
      const id = profile.from_e64(this.$route.params.phone_number)
      const [person, posts, posters] = await Promise.all([
        profile.load(id),
        profile.items(id, 'posts/index'),
        profile.directory(id, 'posters')
      ])
      this.person = person
      console.info(`Views ${person.first_name}'s profile`)
      this.populate_page(person, posts, posters)
      this.limit = growth.first()
    },
    methods: {
      avatar_loaded(avatar) {
        this.avatar = avatar
      },
      async next_page() {
        const id = profile.from_e64(this.$route.params.phone_number)
        const posts = await profile.items(id, `posts/${this.limit}`)
        if (posts.length > 0) {
          this.populate_page(this.person, posts)
          this.limit = growth.next(this.limit)
        }
      },
      populate_page(person, posts, posters) {
        const days = new Map()
        posts = [...this.condense_posts(posts, person),
                ...this.prepare_posters(posters, person)]
        posts.sort(this.newer_first)
        posts.forEach(post => this.insert_post_into_day(post, days))
        this.pages = new Map(this.pages.set(`posts.${this.limit}`, days))
      }
    }
  }
</script>
<style lang='stylus'>
  section#profile
    & > header
      z-index: 2
      position: absolute
      width:100%
      & > a
        -webkit-tap-highlight-color: blue
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
    & > menu
      display: flex
      justify-content: flex-end
      padding: base-line
      margin-top -(base-line * 4 )
      & > a
        text-align: right
        & > svg
          fill: red
    & > figure
    & > div
      max-width: page-width
      margin: auto
      padding: base-line base-line 0 base-line
    & > div
      display:flex
      flex-direction: column
      & > section.day
        display:flex
        flex-direction: column
        &.today
          flex-direction: column-reverse
          & > header
            order: 1
        & > header > h4
          margin-top: base-line
        & > div > figure
          margin-bottom: base-line
          & > figcaption
            span, a
              display:none
            time
              margin-bottom: base-line
</style>

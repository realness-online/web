’<template lang="html">
  <section id="profile" class="page" ref='profile'>
    <header>
      <svg></svg>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-avatar v-bind:by_reference="true" :person="person"></profile-as-avatar>
    <profile-as-figure :person='person'></profile-as-figure>
    <div id="pages-of-posts">
      <div :itemprop="page_name" v-for="[page_name, days] in pages" :key="page_name">
        <section class="day" v-for="[date, day] in days" :key="date" v-bind:class="{today: is_today(date)}">
          <header><h4>{{as_day(date)}}</h4></header>
          <post-as-article v-for="post in day" :key="post.id"
                           :post="post"
                           :person="post.person"
                           @end-of-articles="next_page">
          </post-as-article>
        </section>
      </div>
    </div>
  </section>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import date_mixin from '@/mixins/date'
  import condense_posts from '@/mixins/condense_posts'
  import profile from '@/helpers/profile'
  import logo_as_link from '@/components/logo-as-link'
  import growth from '@/modules/growth'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [date_mixin, condense_posts, posts_into_days],
    components: {
      'profile-as-figure': profile_as_figure,
      'profile-as-avatar': profile_as_avatar,
      'logo-as-link': logo_as_link,
      'post-as-article': as_article
    },
    data() {
      return {
        pages: new Map(),
        limit: growth.first(),
        working: true,
        person: {}
      }
    },
    mounted() {
      document.body.scrollTop = document.documentElement.scrollTop = 0
    },
    async created() {
      const id = profile.from_e64(this.$route.params.phone_number)
      let [person, posts] = await Promise.all([
        profile.load(id),
        profile.items(id, 'posts')
      ])
      this.person = person
      this.populate_pages(person, posts)
    },
    methods: {
      next_page(){},
      populate_pages(person, posts) {
        const days = new Map()
        posts = this.condense_posts(posts, person)
        posts.forEach(post => this.insert_post_into_day(post, days))
        this.pages = new Map(this.pages.set(`posts`, days));
        this.working = false
      }
    }
  }
</script>
<style lang='stylus'>
  section#profile
    & > header
      margin-bottom: -(base-line * 4)
      z-index: 2
      position: relative
      & > a
        -webkit-tap-highlight-color: blue
    & > figure
    & > div
      margin: auto
      max-width: page-width
      padding: base-line
      & > article.silent
        display: none
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
      fill: white
</style>

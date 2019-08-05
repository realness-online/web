<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-if="working" name="working"></icon>
    <manage-avatar v-else></manage-avatar>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form :person='me'></profile-as-form>
    </div>
    <div id="pages-of-posts">
      <div :itemprop="page_name" v-for="[page_name, days] in pages" :key="page_name">
        <section class="day" v-for="[date, day] in days" :key="date" v-bind:class="{today: is_today(date)}">
          <header><h4>{{date}}</h4></header>
          <post-as-article v-for="post in day" :key="post.id"
                           :post="post"
                           :person="me"
                           @end-of-articles="next_page"
                           @saved="save_page">
          </post-as-article>
        </section>
      </div>
    </div>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/helpers/profile'
  import { person_local, posts_local } from '@/modules/LocalStorage'
  import growth from '@/modules/growth'
  import posts_into_days from '@/mixins/posts_into_days'
  import create_date from '@/mixins/create_date'
  import condense_posts from '@/mixins/condense_posts'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import manage_avatar from '@/components/profile/manage-avatar'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [create_date, condense_posts, posts_into_days],
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'post-as-article': as_article,
      'manage-avatar': manage_avatar
    },
    data() {
      return {
        me: person_local.as_object(),
        pages: new Map(),
        limit: growth.first(),
        working: false,
        signed_in: false,
        image_file: null,
        chronological: true
      }
    },
    async created() {
      const days = new Map()
      const posts = this.condense_posts(posts_local.as_list(), this.me)
      posts.forEach(post => this.insert_post_into_day(post, days))
      this.pages.set('posts', days)
      const user = firebase.auth().currentUser
      if (user) {
        this.signed_in = true
        const id = profile.from_e64(user.phoneNumber)
        this.me = await profile.load(id)
      }
    },
    methods: {
      is_today(date) {
        if (date.indexOf('Today') > -1) return true
        else return false
      },
      async next_page() {
        const days = new Map()
        let posts = await posts_local.next_list(this.limit)
        if (posts.length > 0) {
          posts = this.condense_posts(posts, this.me)
          posts.forEach(post => this.insert_post_into_day(post, days))
          this.limit = growth.next(this.limit)
        }
      },
      async save_me(event) {
        if (this.signed_in) {
          this.me.id = profile.from_e64(this.signed_in.phoneNumber)
          if (!this.me.avatar) {
            this.me.avatar = (await profile.load(this.me.id)).avatar
          }
        }
        this.$nextTick(_ => person_local.save())
      },
      async save_page(event, page_name) {
        console.log('save_page', page_name)
        this.$nextTick(_ => {
          // const page = LocalStorage.new(page_name)
          // page.save()
        })
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    &.signed_in
      & > header
        margin-bottom: -(base-line * 4)
        position: relative
        z-index: 2
      #phone
        display: none
    & > div#login
    & > div#pages-of-posts
      max-width: page-width
      margin: auto
      padding: base-line base-line 0 base-line
      & > form
        margin-top: base-line
    div[itemprop="posts"]
      display:flex
      flex-direction: column-reverse
      & > section.day
        display:flex
        flex-direction: column
        &.today
          flex-direction: column-reverse
          & > header
            order: 1
        & > header > h4
          margin-top: base-line
</style>

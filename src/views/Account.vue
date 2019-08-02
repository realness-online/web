<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-if="working" name="working"></icon>
    <manage-avatar @changed='save_me'></manage-avatar>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form :person='me'></profile-as-form>
    </div>
    <div id="pages-of-posts">
      <div itemprop="posts" v-for="[page_name, days] in pages" :key="page_name">
        <section class="day" v-for="[date, day] in days" :key="day" v-bind:class="{today: is_today(date)}" >
          <header><h4>{{date}}</h4></header>
          <posts-as-article v-for="post in day" :key="post.id" :post="post" @end-of-articles="load_more_posts"></posts-as-article>
        </section>
      </div>
    </div>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/models/profile_id'
  import { person_local, posts_local } from '@/modules/LocalStorage'
  import growth from '@/modules/growth'
  import posts_into_days from '@/mixins/posts_into_days'
  import date_formating from '@/mixins/date_formating'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import manage_avatar from '@/components/profile/manage-avatar'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [date_formating, posts_into_days],
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'posts-as-article': as_article,
      'manage-avatar': manage_avatar
    },
    data() {
      return {
        pages: [],
        me: person_local.as_object(),
        limit: growth.first(),
        auth: firebase.auth(),
        working: false,
        signed_in: false,
        avatar_changed: false,
        image_file: null,
        chronological: true
      }
    },
    async created() {
      this.pages.push(await posts_local.as_list())
      const user = this.auth.currentUser
      if (user) {
        this.signed_in = true
        const id = profile.from_e64(user.phoneNumber)
        this.me = await profile.load(id)
      }
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', this.save_me)
    },
    updated() {
      this.$nextTick(() => this.observe_posts())
    },
    computed: {
      show_avatar() {
        if (this.signed_in && !this.working) {
          return true
        } else {
          return false
        }
      }
    },
    methods: {
      is_today(date) {
        if (date.indexOf('Today') > -1) return true
        else return false
      },
      toggle_post(post) {
        post.muted = !post.muted
        this.$nextTick(_ => posts_local.save())
      },
      async load_more_posts() {
        const older_posts = await posts_local.next_list(this.limit)
        if (older_posts.length > 0) {
          this.pages.push(older_posts)
          this.limit = growth.next(this.limit)
        }
      },
      async save_me(event) {
        const user = this.auth.currentUser
        if (user) {
          this.me.id = profile.from_e64(user.phoneNumber)
          if (!this.me.avatar) {
            this.me.avatar = (await profile.load(this.me.id)).avatar
          }
        }
        this.$nextTick(_ => person_local.save())
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
      & > div > form
        #phone
          display: none
    & > div
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
<style lang="stylus">

</style>

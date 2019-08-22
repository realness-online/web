<template lang="html">
  <section id="account" v-bind:class="{'signed-in': signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <manage-avatar @new-avatar="update_avatar"></manage-avatar>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form @modified="save_me" :person='me'></profile-as-form>
    </div>
    <div id="pages-of-posts">
      <div :itemprop="page_name" v-for="[page_name, days] in pages" :key="page_name">
        <section class="day" v-for="[date, day] in days" :key="date" v-bind:class="{today: is_today(date)}">
          <header><h4>{{as_day(date)}}</h4></header>
          <post-as-article v-for="post in day" :key="post.id"
                           :editable="is_editable(page_name)"
                           :post="post"
                           :person="me"
                           @end-of-articles="next_page"
                           @modified="save_page">
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
  import date_mixin from '@/mixins/date'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import manage_avatar from '@/components/profile/manage-avatar'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [date_mixin, condense_posts, posts_into_days],
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
        signed_in: false,
        image_file: null
      }
    },
    async created() {
      firebase.auth().onAuthStateChanged(async user => {
        if (user) {
          this.signed_in = true
          const id = profile.from_e64(user.phoneNumber)
          this.me = await profile.load(id)
        }
      })
      const days = this.populate_days(posts_local.as_list(), this.me)
      this.pages.set('posts', days)
    },
    methods: {
      update_avatar(avatar) {
        this.me.avatar = avatar
      },
      is_editable(page_name) {
        if (page_name === 'posts') return true
        else return false
      },
      async next_page() {
        const days = new Map()
        let posts = await posts_local.next_page(this.limit)
        if (posts.length > 0) {
          posts = this.condense_posts(posts, this.me)
          posts.forEach(post => this.insert_post_into_day(post, days))
          this.pages = new Map(this.pages.set(`posts.${this.limit}`, days))
          this.limit = growth.next(this.limit)
        }
      },
      async save_me(event) {
        if (this.signed_in) {
          this.me.id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
          if (!this.me.avatar) {
            this.me.avatar = (await profile.load(this.me.id)).avatar
          }
        }
        await this.$nextTick()
        person_local.save()
      },
      async save_page(event) {
        console.log('save_page', posts_local.selector)
        await posts_local.save()
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    & > header
      margin-bottom: -(base-line * 4)
      position: relative
      z-index: 2
    & > div#login
      margin: auto
      max-width: page-width
      padding: base-line
      form
        margin-top: base-line
</style>
<style lang="stylus">
  section#account > div#pages-of-posts
    max-width: page-width
    margin: auto
    padding: base-line base-line 0 base-line
    & > div[itemprop]
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

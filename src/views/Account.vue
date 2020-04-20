<template lang="html">
  <section id="account" :class="{'signed-in': signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <avatar-as-form @new-avatar="new_avatar" :person='me'></avatar-as-form>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form @modified="save_me" :person='me'></profile-as-form>
    </div>
    <div id="pages-of-posts">
      <div :itemprop="page_name" v-for="[page_name, days] in pages" :key="page_name">
        <section class="day" v-for="[date, day] in days" :key="date" :class="{today: is_today(date)}">
          <header><h4>{{as_day(date)}}</h4></header>
          <post-as-article v-for="post in day" :key="post.id"
                           :post="post"
                           :person="me"
                           :editable="is_editable(page_name)"
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
  import itemid from '@/helpers/itemid'
  import { me, posts_storage } from '@/persistance/Storage'
  import growth from '@/modules/growth'
  import date_mixin from '@/mixins/date'
  import signed_in from '@/mixins/signed_in'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import avatar_as_form from '@/components/avatars/as-form'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [signed_in, date_mixin, condense_posts, posts_into_days],
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'post-as-article': as_article,
      'avatar-as-form': avatar_as_form
    },
    data () {
      return {
        me: me.as_object(),
        pages: new Map(),
        limit: growth.first(),
        image_file: null
      }
    },
    async created () {
      console.info(`${this.me.first_name} views their account page`)
      const days = this.populate_days(posts_storage.as_list(), this.me)
      this.pages.set('posts', days)
      if (this.signed_in) {
        const id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
        this.me = await itemid.as_object(id)
        await this.sync_posts()
      }
    },
    methods: {
      async new_avatar (avatar_url) {
        this.me.avatar = avatar_url
        await this.$nextTick()
        me.save()
      },
      is_editable (page_name) {
        if (page_name === 'posts') return true
        else return false
      },
      async save_me (event) {
        if (this.signed_in) {
          this.me.id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
        }
        await this.$nextTick()
        me.save()
      },
      async sync_posts () {
        const days = this.populate_days(await posts_storage.sync_list(), this.me)
        const new_pages = new Map()
        new_pages.set('posts', days)
        this.pages = new_pages
      },
      async save_page (event) {
        await this.sync_posts()
        await this.$nextTick()
        await posts_storage.save()
      },
      async next_page () {
        const days = new Map()
        let posts = await itemid.load(`${this.me.id}/posts/${this.limit}`)
        if (posts.length > 0) {
          posts = this.condense_posts(posts, this.me)
          posts.forEach(post => this.insert_post_into_day(post, days))
          this.pages = new Map(this.pages.set(`posts.${this.limit}`, days))
          this.limit = growth.next(this.limit)
        }
      }
    }
  }
</script>
<style lang='stylus'>
  section#account
    svg.background
      fill: red
    & > header
      position: absolute
      width:100%
      z-index: 2
    & > div#login
      margin: auto
      max-width: page-width
      padding: base-line
      form
        margin-top: base-line
    & > div#pages-of-posts
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

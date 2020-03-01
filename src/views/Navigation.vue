<template>
  <section id="navigation" class="page" :class="{ posting }">
    <nav :class="onboarding">
      <router-link v-if="!posting" to="/account" class="black" tabindex="-1">{{user_name}}</router-link>
      <router-link v-if="!posting" to="/" class="green" tabindex="-1">Tonight!</router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">Posters</router-link>
      <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">Feed</router-link>
      <router-link v-if="!posting" :to="friend_or_phone_book()" class="blue" tabindex="-1">Relations</router-link>
      <button v-if="posting" @click="done_posting" tabindex="-1">Done</button>
      <post-as-textarea @toggle-keyboard="posting = !posting" @post-added="add_post" class="red"></post-as-textarea>
    </nav>
    <aside>
      <my-figure :person="me"></my-figure>
      <div itemprop="posts">
        <section class="day" v-for="[date, day] in days" :key="date" :class="{today: is_today(date)}">
          <header><h4>{{as_day(date)}}</h4></header>
          <post-as-article v-for="post in day"
                           :key="as_id(post)"
                           :post="post"
                           :person="me">
          </post-as-article>
        </section>
      </div>
    </aside>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import date_mixin from '@/mixins/date'
  import signed_in from '@/mixins/signed_in'
  import profile_helper from '@/helpers/profile'
  import post_helper from '@/helpers/post'
  import { posts_storage, person_storage as me, relations_storage } from '@/persistance/Storage'
  import as_textarea from '@/components/posts/as-textarea'
  import as_figure from '@/components/profile/as-figure'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [signed_in, condense_posts, posts_into_days, date_mixin],
    components: {
      'my-figure': as_figure,
      'post-as-article': as_article,
      'post-as-textarea': as_textarea
    },
    data() {
      return {
        signed_in: true,
        me: me.as_object(),
        posting: false,
        has_posts: (posts_storage.as_list().length > 0),
        five_minutes_ago: Date.now() - (1000 * 60 * 5),
        days: new Map()
      }
    },
    async created() {
      console.info(this.me.first_name, 'uses the navigation')
      this.days = this.populate_days(posts_storage.as_list(), this.me)
    },
    async mounted() {
      await Promise.all([
        this.sync_posts(),
        this.sync_profile()
      ])
    },
    computed: {
      onboarding() {
        const relations_count = relations_storage.as_list().length
        return {
          'has-posts': this.has_posts,
          'signed-in': (this.has_posts && this.signed_in),
          'has-friends': (this.signed_in && relations_count > 0)
        }
      },
      user_name() {
        return this.me.first_name || 'You'
      }
    },
    methods: {
      as_id(post) {
        return post_helper.as_id(post, this.me)
      },
      done_posting(event) {
        document.querySelector('nav > button').focus()
      },
      friend_or_phone_book() {
        if (relations_storage.as_list().length < 1) return '/phone-book'
        else return '/relations'
      },
      async add_post(post) {
        this.has_posts = true
        const posts = [post]
        this.days = new Map(this.populate_days(posts, this.me, this.days))
        await this.$nextTick()
        posts_storage.save()
      },
      should_sync(last_synced) {
        if (!last_synced || (this.signed_in && this.five_minutes_ago > last_synced)) {
          return true
        }
        return false
      },
      async sync_profile() {
        if (this.should_sync(sessionStorage.getItem('profile-synced'))) {
          firebase.auth().onAuthStateChanged(async user => {
            if (user) {
              const id = profile_helper.from_e64(user.phoneNumber)
              this.me = await profile_helper.load(id)
              await me.save()
              sessionStorage.setItem('profile-synced', Date.now())
            }
          })
        }
      },
      async sync_posts() {
        if (this.should_sync(sessionStorage.getItem('posts-synced'))) {
          firebase.auth().onAuthStateChanged(async user => {
            if (user) {
              const synced_posts = await posts_storage.sync_list()
              this.days = new Map(this.populate_days(synced_posts, this.me))
              await this.$nextTick()
              sessionStorage.setItem('posts-synced', Date.now())
              await posts_storage.save()
              // await posts_storage.optimize()
            }
          })
        }
      }
    }
  }
</script>
<style lang="stylus">
  section#navigation.page
    width: 100%
    padding: base-line
    display: flex
    align-items: center
    margin: auto
    max-width: page-width
    height: 100vh
    @media (max-height: pad-begins) and (orientation: landscape)
      height: auto
    &.posting
      height: inherit
      align-items: flex-end
    &.posting > nav
      min-height: round(base-line * 9)
      height: round(base-line * 9)
      & > textarea
        text-align: inherit
        margin-top: base-line
        padding: 0
        border-radius: 0
    & > nav
      display: grid
      grid-gap: base-line
      grid-template-columns: 1fr 1fr
      grid-template-rows: repeat(1fr)
      align-items: stretch
      min-height: round(base-line * 16)
      max-height: page-width
      height: 100vmin
      width: 100vw
      &.has-posts
        & > [href='/account']
          visibility: visible
      &.signed-in
        & > [href='/posters']
        & > [href='/relations']
        & > [href='/phone-book']
          visibility: visible
      &.has-friends
        & > [href='/feed']
          visibility: visible
      & > a[href='/']
        visibility: visible
      & > a
        visibility: hidden
        text-transform: capitalize
        text-align: left
        border-width: 1px
        border-style: solid
        &:focus
          color:transparent
          transition-duration: 0.6s
          transition: all
          outline: none
        &:nth-child(even)
         text-align: right
        &:active
          border-width: 1vmax
          color:transparent
      & > a
      & > textarea
        padding: base-line
        border-radius: base-line
      & > button
        align-self: flex-end
        width: base-line * 4
        display: block
      & > textarea
        text-align: right
</style>

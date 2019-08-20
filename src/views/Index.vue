<template>
  <section id="home" class="page">
    <nav id="main" v-bind:class="onboarding">
      <post-as-textarea @post-added="add_post" @toggle-keyboard="posting = !posting" class="red" ></post-as-textarea>
      <button v-if="posting" @click="done_posting" tabindex="-1">Done</button>
      <router-link v-if="!posting" :to="friend_or_phone_book()" class="blue" tabindex="-1">Friends</router-link>
      <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">Feed</router-link>
      <router-link v-if="!posting" to="/events" class="green" tabindex="-1">Events</router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">Posters</router-link>
      <router-link v-if="!posting" to="/account" class="black" tabindex="-1">{{user_name}}</router-link>
    </nav>
    <aside>
      <my-figure :person="me"></my-figure>
      <div itemprop="posts">
        <section class="day" v-for="[date, day] in days" :key="date" v-bind:class="{today: is_today(date)}">
          <header><h4>{{as_day(date)}}</h4></header>
          <post-as-article v-for="post in day"
                           :key="as_id(post)"
                           :post="post"
                           :person="me">
          </post-as-article>
        </section>
      </div>
    </aside>
    <h6 class="app_version">{{version}}</h6>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import posts_into_days from '@/mixins/posts_into_days'
  import condense_posts from '@/mixins/condense_posts'
  import date_mixin from '@/mixins/date'
  import profile_helper from '@/helpers/profile'
  import post_helper from '@/helpers/post'
  import { posts_local, person_local, relations_local } from '@/modules/LocalStorage'
  import as_textarea from '@/components/posts/as-textarea'
  import as_figure from '@/components/profile/as-figure'
  import as_article from '@/components/posts/as-article'
  export default {
    mixins: [condense_posts, posts_into_days, date_mixin],
    components: {
      'my-figure': as_figure,
      'post-as-article': as_article,
      'post-as-textarea': as_textarea
    },
    data() {
      return {
        me: person_local.as_object(),
        posting: false,
        signed_in: false,
        has_posts: (posts_local.as_list().length > 0),
        five_minutes_ago: Date.now() - (1000 * 60 * 5),
        version: process.env.VUE_APP_VERSION,
        days: this.populate_days(posts_local.as_list(), person_local.as_object())
      }
    },
    async created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) this.signed_in = true
      })
    },
    async mounted() {
      await Promise.all([
        this.sync_posts(),
        this.sync_profile()
      ])
    },
    computed: {
      onboarding() {
        const relations_count = relations_local.as_list().length
        return {
          'signed-in': this.signed_in,
          'has-posts': this.has_posts,
          'has-friends': (this.signed_in && relations_count > 0)
        }
      },
      user_name() {
        return this.me.first_name || 'You'
      }
    },
    methods: {
      done_posting(event) {
        document.querySelector('nav > button').focus()
      },
      friend_or_phone_book() {
        if (relations_local.as_list().length < 1) return '/phone-book'
        else return '/relations'
      },
      as_id(post) {
        return post_helper.as_id(post, this.me)
      },
      add_post(post) {
        console.log('add_post', post)
        this.has_posts = true
        const posts = [post]
        this.days = this.populate_days(posts, this.me, this.days)
        this.$nextTick(async() => posts_local.save())
      },
      should_sync(last_synced) {
        if (!last_synced || (this.signed_in && this.five_minutes_ago > last_synced)) {
          return true
        }
        return false
      },
      async sync_profile() {
        if (this.should_sync(sessionStorage.getItem('profile-synced'))) {
          const user = firebase.auth().currentUser
          if (user) {
            const id = profile_helper.from_e64(user.phoneNumber)
            this.me = await profile_helper.load(id)
            this.$nextTick(async() => {
              await person_local.save()
              sessionStorage.setItem('profile-synced', Date.now())
            })
          }
        }
      },
      async sync_posts() {
        if (this.should_sync(sessionStorage.getItem('posts-synced'))) {
          this.posts = await posts_local.sync_list()
          this.$nextTick(async() => {
            sessionStorage.setItem('posts-synced', Date.now())
            await posts_local.save()
            await posts_local.optimize()
          })
        }
      }
    }
  }
</script>
<style lang="stylus">
  nav#main
    display: grid
    grid-gap: base-line
    grid-template-columns: 1fr 1fr
    grid-template-rows: repeat(1fr)
    align-items: stretch
    min-height: base-line * 18
    height: 100vmin
    width: 100vmin
    & > a
    & > textarea
      padding: base-line
      border-radius: base-line
  nav#main
    max-height: page-width
    & > button
      align-self: flex-end
      width: base-line * 4
      display: none
      @media (min-width: max-screen)
        display: block
    & > a
      visibility: hidden
      text-transform: capitalize
      &:focus
        color:transparent
        transition-duration: 0.6s
        transition: all
        outline: none
    & > a
      text-align: left
      border-width: 1px
      border-style: solid
      &:nth-child(even)
        text-align: right
      &:active
        border-width: 1vmax
        color:transparent
  nav#main
    &.has-posts
      & > [href='/account']
        visibility: visible
    &.signed-in
      & > [href='/relations']
      & > [href='/phone-book']
        visibility: visible
    &.has-friends
      & > [href='/feed']
      & > [href='/events']
      & > [href='/posters']
        visibility: visible
</style>
<style lang="stylus">
  section#home.page
    padding: base-line
    height:100vh
    display: flex
    align-items: center
    margin:auto
    max-width: page-width
    & > h6.app_version
      margin: 0
      position: fixed
      bottom: (base-line / 2)
      left: (base-line / 2)
</style>

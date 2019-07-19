<template>
  <nav id="main" v-bind:class="onboarding">
    <post-as-textarea v-on:toggle-keyboard="posting = !posting" class="red" ></post-as-textarea>
    <button @click="done_posting" v-if="posting" tabindex="-1">done</button>
    <router-link v-if="!posting" :to="friend_or_phone_book()" class="blue" tabindex="-1">Friends</router-link>
    <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">Feed</router-link>
    <router-link v-if="!posting" to="/events" class="green" tabindex="-1">Events</router-link>
    <router-link v-if="!posting" to="/where" class="green" tabindex="-1">Where</router-link>
    <router-link v-if="!posting" to="/account" class="black" tabindex="-1">{{user_name}}</router-link>
  </nav>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import as_textarea from '@/components/posts/as-textarea'
  import { posts_storage, person_storage, relations_storage } from '@/modules/Storage'
  export default {
    components: {
      'post-as-textarea': as_textarea
    },
    created() {
      this.$bus.$on('post-added', _ => { this.has_posts = true })
      firebase.auth().onAuthStateChanged(this.auth_check)
    },
    data() {
      return {
        posting: false,
        person: person_storage.as_object(),
        signed_in: posts_storage.as_list().length > 0,
        has_posts: posts_storage.as_list().length > 0
      }
    },
    methods: {
      auth_check(user) {
        if (user) {
          this.signed_in = true
        } else {
          this.signed_in = false
        }
      },
      done_posting(event) {
        document.querySelector('nav > button').focus()
      },
      friend_or_phone_book() {
        if (relations_storage.as_list().length < 1) {
          return '/phone-book'
        } else {
          return '/relations'
        }
      }
    },
    computed: {
      onboarding() {
        return {
          is_person: this.signed_in,
          has_posts: this.has_posts,
          has_friends: (this.signed_in && localStorage.getItem('relations-count') > 0),
          has_friends: true,
          can_event: (this.signed_in && localStorage.getItem('relations-count') >= 25),
          can_where: (this.signed_in && localStorage.getItem('relations-count') >= 25)
        }
      },
      user_name() {
        return this.person.first_name || 'You'
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
    &.has_posts
      & > [href='/account']
        visibility: visible
    &.is_person
      & > [href='/account']
      & > [href='/relations']
      & > [href='/phone-book']
        visibility: visible
    &.has_friends
      & > [href='/feed']
        visibility: visible
    &.can_event
      & > [href='/events']
        visibility: visible
    &.can_where
      & > [href='/where']
        visibility: visible
</style>

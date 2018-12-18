<template>
  <nav id="main_nav" v-bind:class="onboarding">
    <post-as-textarea v-on:toggle-keyboard="posting = !posting" class="red" ></post-as-textarea>
    <router-link v-if="!posting" to="/relations" class="blue">Relations</router-link>
    <router-link v-if="!posting" to="/feed" class="blue">Feed</router-link>
    <router-link v-if="!posting" to="/events" class="green">Events</router-link>
    <router-link v-if="!posting" to="/where" class="green">Where</router-link>
    <router-link v-if="!posting" to="/profile" class="black">{{user_name}}</router-link>
  </nav>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import as_textarea from '@/components/posts/as-textarea'
  import {person_storage} from '@/modules/Storage'
  export default {
    components: {
      'post-as-textarea': as_textarea
    },
    created() {
      this.$bus.$on('post-added', () => {
        this.has_posts = true
      })
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          this.signed_in = true
        } else {
          this.signed_in = false
        }
      })
    },
    data() {
      return {
        posting: false,
        signed_in: localStorage.getItem('posts-count') > 0,
        person: person_storage.as_object(),
        has_posts: localStorage.getItem('posts-count') > 0
      }
    },
    computed: {
      onboarding() {
        return {
          is_person: this.signed_in,
          has_posts: this.has_posts,
          has_friends: (this.signed_in && localStorage.getItem('relations-count') > 0),
          can_event: (this.signed_in && localStorage.getItem('relations-count') >= 5),
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
  @require '../style/variables'
  nav#main_nav
    min-height: 100vh
    display: flex
    flex-direction:row
    flex-wrap:wrap
    align-content: space-evenly
    justify-content:space-evenly
    align-items: flex-start
    & > a
      visibility: hidden
      text-transform: capitalize
      &:focus
        color:transparent
        transition-duration: 0.6s
        transition: all
        margin:0.5vh 0.5vw
        width: 43vw
        height: 23vh
        outline: none
    & > *
      font-weight: bold
      -webkit-tap-highlight-color: transparent
      transition-timing-function:ease-out
      text-align: left
      width: 44vw
      height: 24vh
      border-width: 1vmax
      border-style: solid
      border-radius: base-line
      padding: base-line
      &:nth-child(even)
        text-align: right
        padding-right:base-line
      &:active
        border-width: 1.33vh
        width: 42vw
        height: 22vh
        margin: 1vh 1vw
        color:transparent
  nav#main_nav
    &.has_posts
      & > [href='/profile']
        visibility: visible
    &.is_person
      & > [href='/profile']
      & > [href='/relations']
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

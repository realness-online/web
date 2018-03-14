<template>
  <nav id="main_nav" v-bind:class="onboarding">
    <router-link v-if="show" to="/profile" class="black">{{user_name}}</router-link>
    <router-link v-if="show" to="/relationships" class="green">Relations</router-link>
    <router-link v-if="show" to="/groups" class="green">Groups</router-link>
    <router-link v-if="show" to="/events" class="blue">Events</router-link>
    <router-link v-if="show" to="/feed" class="blue">Feed</router-link>
    <wat-textarea class="red" tabindex="1" v-on:toggle-keyboard="show = !show" ></wat-textarea>
  </nav>
</template>

<script>
  import wat_textarea from '@/components/wat-textarea'
  import {person_storage} from '@/modules/Storage'
  export default {
    components: {
      'wat-textarea': wat_textarea
    },
    created: function() {
      this.$bus.$on('post-added', () => {
        this.posts = true
      })
    },
    data() {
      return {
        show: true,
        person: person_storage.as_object(),
        posts: localStorage.getItem('posts-count') > 0,
        friends: localStorage.getItem('friends-count') > 0,
        events: localStorage.getItem('friends-count') >= 5,
        groups: localStorage.getItem('friends-count') >= 25
      }
    },
    computed: {
      onboarding() {
        return {
          posts: this.posts,
          person: this.person ? true : false,
          friends: this.friends,
          events: this.events,
          groups: this.groups
        }
      },
      user_name() {
        return this.person.first_name || 'Profile'
      }
    }
  }
</script>

<style lang="stylus">
  @require '../style/variables'
  nav#main_nav
    min-height: 83vh
    display: flex
    flex-direction:row
    flex-wrap:wrap
    align-content: space-evenly
    justify-content:space-evenly
    align-items: flex-start
    & > *
      -webkit-tap-highlight-color: transparent
      animation-name: shimer
      animation-delay: 0.10s
      animation-duration: 0.25s
      transition-duration: 0
      transition-timing-function:ease-out
      text-align: left
      width: 44vw
      height: 24vh
      border-width: 1vmax
      border-style: solid
      border-radius: 3vw
      padding:base-line
    & > a
      visibility: hidden
      &:nth-child(even)
        text-align: right
        padding-right:base-line
      &:active
        border-width: 1.33vh
        width: 42vw
        height: 22vh
        margin: 1vh 1vw
        color:transparent
      &:focus
        color:transparent
        transition-duration: 0.6s
        transition: all
        margin:0.5vh 0.5vw
        width: 43vw
        height: 23vh
        outline: none
  nav#main_nav
    &.posts
      & > [href='/profile']
        visibility: visible
    &.person
      & > [href='/profile']
      & > [href='/relationships']
        visibility: visible
    &.friends
      & > [href='/feed']
        visibility: visible
    &.events
      & > [href='/events']
        visibility: visible
     &.groups
       & > [href='/groups']
         visibility: visible
</style>

<template>
  <section>
    <header>
      <nav id="main_nav" class='person focus_on_post'>
        <router-link v-if="show" to="/profile" class="black">Sign up</router-link>
        <router-link v-if="show" to="/relationships" class="green">Relations</router-link>
        <router-link v-if="show" to="/groups" class="green">Groups</router-link>
        <router-link v-if="show" to="/events" class="blue">Events</router-link>
        <router-link v-if="show" to="/feed" class="blue">Feed</router-link>
        <wat-textarea class="red" v-on:toggle-keyboard="show = !show" tabindex="1"></wat-textarea>
      </nav>
    </header>
    <activity-list  :activity="activity"></activity-list>
    <posts-list   :posts="posts"></posts-list>
  </section>
</template>

<style lang="stylus">
  @require "./application"
  nav#main_nav
    width: 100vw
    min-height: 83vh
    display: flex
    flex-direction:row
    flex-wrap:wrap
    align-content: space-evenly
    justify-content:space-evenly
    align-items: flex-start
    // padding-top:3vh
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
        color:yellow
        transition-duration: 0.6s
        opacity:1
        transition: all
        margin:0.5vh 0.5vw
        width: 43vw
        height: 23vh
        outline: none

    &.guest
      & > [href='/profile']
      & > [href='/feed']
      & > [href='/relationships']
      & > [href='/events']
      & > [href='/groups']
        visibility: hidden

     nav.they_post
       & > [href='/profile']
       & > [href='/relationships']
       & > [href='/events']
       & > [href='/groups']
         visibility: hidden

    &.person
      & > [href='/events']
      & > [href='/groups']
        visibility: hidden

    &.has_ten_friends
      & > [href='/groups']
        visibility: hidden

     &.has_25_friends
       //
</style>

<script>
  import wat_textarea from '@/components/wat-textarea'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  export default {
    components: {
      'wat-textarea': wat_textarea,
      'activity-list': activity_list,
      'posts-list': posts_list
    },
    data() {
      return {
        activity: activity_storage.get_items(),
        posts: posts_storage.get_items(),
        show: true
      }
    }
  }
</script>

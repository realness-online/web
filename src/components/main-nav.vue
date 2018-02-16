<template>
  <nav id="main_nav" v-bind:class="onboarding">
    <router-link v-if="show" to="/profile" class="black">Name</router-link>
    <router-link v-if="show" to="/relationships" class="green">Relations</router-link>
    <router-link v-if="show" to="/groups" class="green">Groups</router-link>
    <router-link v-if="show" to="/events" class="blue">Events</router-link>
    <router-link v-if="show" to="/feed" class="blue">Feed</router-link>
    <wat-textarea class="red" v-on:toggle-keyboard="show = !show" tabindex="1"></wat-textarea>
  </nav>
</template>

<script>
  import wat_textarea from '@/components/wat-textarea'
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
        posts: localStorage.getItem('posts-count') > 0,
        person: false,
        events: false,
        groups: false
      }
    },
    computed: {
      onboarding() {
        return {
          posts: this.posts > 0,
          person: this.person,
          events: this.events,
          groups: this.groups
        }
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
        color:orange
        transition-duration: 0.6s
        opacity:1
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
      & > [href='/feed']
        visibility: visible
    &.events
      & > [href='/events']
        visibility: visible
     &.groups
       & > [href='/groups']
         visibility: visible
</style>

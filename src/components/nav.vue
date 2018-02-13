<template>
  <nav id="main_nav" class='guest'>
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
    data() {
      return {
        show: true
      }
    }
  }
</script>

<style lang="stylus">
  @require '../application'
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

    &.guest-posts
      & > [href='/relationships']
      & > [href='/events']
      & > [href='/groups']
        visibility: hidden

    &.person
      & > [href='/events']
      & > [href='/groups']
        visibility: hidden

    &.has-ten-friends
      & > [href='/groups']
        visibility: hidden

     &.has-25-friends
       //
</style>

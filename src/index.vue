<template>
  <nav id="main_nav">
    <router-link to="/profile" class="black">Profile</router-link>
    <router-link to="/relationships" class="green">Relationships</router-link>
    <router-link to="/groups" class="green">Groups</router-link>
    <router-link to="/events" class="blue">Events</router-link>
    <router-link to="/feed" class="blue">Feed</router-link>
    <router-link to="/posts" class="red">Wat?</router-link>
  </nav>
</template>
<style lang="stylus">
  @require "./application.styl"
  nav#main_nav
    width: 100vw
    min-height: 80vh
    display: flex
    flex-direction:row
    flex-wrap:wrap
    align-content: space-evenly
    justify-content:space-evenly
    align-items: flex-start
    padding-top:3vh

    & > *
      -webkit-tap-highlight-color: transparent
      animation-duration: 0
      transition-duration: 0.06s
      transition-timing-function:ease-out
      text-align: left
      width: 44vw
      height: 24vh
      border-width: 1vw
      border-style: solid
      border-radius: 3vw
      padding:base-line
      &:nth-child(even)
        text-align: right
        padding-right:base-line
      &:active
        border-width: 1.33vh
        width: 42vw
        height: 22vh
        margin: 0.5vh 0.75vw
        color:transparent
        transition-property: all
      &:focus
        color:yellow
        transition-duration: 1.6s
        opacity:1
        transition: all
        margin:0.5vh 0.5vw
        width: 43vw
        height: 23vh
        outline: none
</style><script>
</script>

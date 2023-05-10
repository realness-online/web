<template>
  <section id="poster" class="page">
    <as-figure
      :itemid="itemid"
      :optimize="true"
      :slice="false"
      :tabable="true" />
  </section>
</template>
<script setup>
  import AsFigure from '@/components/posters/as-figure'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  const route = use_route()
  const router = use_router()
  const itemid = `${localStorage.me}/posters/${route.params.id}`
  const back = () => {
    const me = localStorage.me.substring(2)
    const id = route.params.id
    router.replace({ path: '/feed', hash: `#${me}-posters-${id}` })
  }
</script>
<style lang="stylus">
  section#poster
    & > figure > svg
      height: 100vh
    & > footer
      padding: base-line
      z-index: 2
      position: fixed
      bottom: 0
      left: 0
      right: 0
      padding: base-line * .5
      background: black-transparent
      & > menu
        width: 100%
        display:flex
        justify-content: space-between
        align-items: center
        & > a  > svg
          cursor: pointer
          fill: blue
          .selected
            fill:red
          &:hover
            fill: red
          &.color > svg.opacity
            fill: black-background
            &:hover
              fill: transparent
          &.remove
          &.finished
          &.share
            fill-opacity: inherit

</style>

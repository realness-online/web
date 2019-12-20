<template lang="html">
  <figure class='feed poster'>
    <figcaption>
      <router-link :to="poster.person.id">
        <profile-as-avatar :person="poster.person"></profile-as-avatar>
      </router-link>
      <hgroup>
        <span class="person">{{poster.person.first_name}} {{poster.person.last_name}}</span>
        <time :datetime="poster.created_at">{{as_time(poster.created_at)}}</time>
      </hgroup>
    </figcaption>
    <icon v-if="actual_poster" name="background"></icon>
    <svg v-if="actual_poster" @click="toggle_slice" :preserveAspectRatio="aspect_ratio"
         :viewBox="actual_poster.view_box" v-html="actual_poster.path">
    </svg>
    <icon v-else name="working"></icon>
  </figure>
</template>
<script>
  import profile from '@/helpers/profile'
  import date_mixin from '@/mixins/date'
  import icon from '@/components/icon'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    mixins: [date_mixin],
    props: ['poster'],
    components: {
      'profile-as-avatar': profile_as_avatar,
      icon
    },
    data() {
      return {
        slice: true,
        observer: null,
        actual_poster: null,
        options: {
          rootMargin: '0px 0px 0px 0px'
        }
      }
    },
    mounted() {
      this.observer = new IntersectionObserver(this.show_poster, this.options)
      this.$nextTick(_ => this.observer.observe(this.$el))
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    computed: {
      aspect_ratio() {
        if (this.slice) return 'xMidYMid slice'
        else return 'xMidYMid meet'
      }
    },
    methods: {
      toggle_slice() {
        this.slice = !this.slice
      },
      async show_poster(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.actual_poster = await profile.item(this.poster.person.id, this.poster.id)
            this.observer.unobserve(this.$el)
          }
        })
      }
    }
  }
</script>
<style lang="stylus">
  figure.feed.poster
    position:relative
    & > figcaption
      display: flex
      justify-content: flex-start
      margin: base-line 0
      & > hgroup
        margin: 0 0 0 (base-line / 2 )
      & a > svg
        cursor: pointer
        shape-outside: circle()
        clip-path: circle()
    & > svg
      width: stretch
      max-width: page-width
      height: 100vh
      &.background
        position: absolute
        fill: blue
        z-index: -1
      &.working
        height:auto
        width: base-line * 5
      @media (max-width: min-screen)
        &:not(.working)
          margin-left -(base-line)
          margin-right -(base-line)
</style>

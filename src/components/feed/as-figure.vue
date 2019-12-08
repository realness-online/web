<template lang="html">
  <figure class='feed poster'>
    <figcaption>
      <router-link :to="poster.person.id">
        <profile-as-avatar :person="poster.person" :by_reference="true"></profile-as-avatar>
      </router-link>
      <hgroup>
        <span class="person">{{poster.person.first_name}} {{poster.person.last_name}}</span>
        <time :datetime="poster.created_at">{{as_time(poster.created_at)}}</time>
      </hgroup>
    </figcaption>
    <svg v-if="actual_poster" preserveAspectRatio="xMidYMin slice"
         :viewBox="actual_poster.view_box" v-html="actual_poster.path"></svg>
    <icon v-else name="working"></icon>
  </figure>
</template>
<script>
  import profile from '@/helpers/profile'
  import date_mixin from '@/mixins/date'
  import icon from '@/components/icon'
  import profile_as_avatar from '@/components/profile/as-avatar'
  export default {
    mixins: [date_mixin],
    props: ['poster'],
    components: {
      'profile-as-avatar': profile_as_avatar,
      icon
    },
    data() {
      return {
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
    methods: {
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
    & > figcaption
      display: flex
      justify-content: flex-start
      margin-bottom: base-line
      & > hgroup
        margin: 0 0 0 (base-line / 2 )
      & a > svg
        fill: blue
        shape-outside: circle()
        clip-path: circle()
        cursor: pointer
    & > svg
      width: auto
      height: 100vh
    @media (max-width: min-screen)
      & > svg
        margin-left -(base-line)
        margin-right -(base-line)

</style>

<template lang="html">
  <figure class='feed poster'>
    <figcaption>
      <router-link :to="poster.person.id">
        <profile-as-avatar :person="poster.person" :by_reference="true"></profile-as-avatar>
      </router-link>
      <time :datetime="poster.created_at">{{as_time(poster.created_at)}}</time>
    </figcaption>
    <svg v-if="actual_poster" preserveAspectRatio="xMidYMin meet"
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
            console.log(this.actual_poster);
            this.observer.unobserve(this.$el)
          }
        })
      }
    }
  }
</script>
<style lang="stylus">
  figure.feed.poster
    & > svg
      width: 100%
      height: 100vh
</style>

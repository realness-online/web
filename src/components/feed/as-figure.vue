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
    <svg v-if="actual_poster" @click="vector_click" :preserveAspectRatio="aspect_ratio"
         :viewBox="actual_poster.view_box" v-html="actual_poster.path">
    </svg>
    <icon v-else name="working"></icon>
    <menu v-if="menu">
      <download-vector :vector="actual_poster" :author="poster.person"></download-vector>
    </menu>
  </figure>
</template>
<script>
  import profile from '@/helpers/profile'
  import date_mixin from '@/mixins/date'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    mixins: [date_mixin, vector_intersection, vector_click],
    props: ['poster'],
    components: {
      'profile-as-avatar': profile_as_avatar,
      'download-vector': download_vector,
      icon
    },
    data() {
      return {
        menu: false,
        actual_poster: null
      }
    },
    methods: {
      async show() {
        this.actual_poster = await profile.item(this.poster.person.id, this.poster.id)
        this.observer.unobserve(this.$el)
      }
    }
  }
</script>
<style lang="stylus">
  figure.feed.poster
    position: relative
    overflow: hidden
    margin-left -(base-line)
    margin-right -(base-line)
    @media (min-width: pad-begins)
      margin: 0
    & >  menu
      display: flex
      justify-content: flex-end
      padding: base-line
      margin-top: -(base-line * 4)
      & > a > svg
        fill: red
    & > svg
      width: stretch
      height: 100%
      max-height: poster-height
      &.background
        fill: blue
      &.working
        height: auto
        width: base-line * 5

</style>

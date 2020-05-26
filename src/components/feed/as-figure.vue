<template lang="html">
  <figure class="feed poster">
    <figcaption>
      <router-link :to="poster.person.id">
        <profile-as-avatar :person="poster.person" />
      </router-link>
      <hgroup>
        <span>{{ poster.person.first_name }}</span>
        <span>{{ poster.person.last_name }}</span>
        <time>{{ as_created_at }}</time>
      </hgroup>
    </figcaption>
    <svg v-if="actual_poster"
         :preserveAspectRatio="aspect_ratio"
         :viewBox="actual_poster.viewbox"
         @click="vector_click"
         v-html="actual_poster.path" />
    <icon v-else name="working" />
    <menu v-if="menu">
      <download-vector :vector="actual_poster" />
    </menu>
  </figure>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    components: {
      'profile-as-avatar': profile_as_avatar,
      'download-vector': download_vector,
      icon
    },
    mixins: [vector_intersection, vector_click],
    props: {
      poster: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        menu: false,
        actual_poster: null
      }
    },
    computed: {
      as_created_at () {
        return 'fix me'
      }
    },
    methods: {
      async show () {
        this.actual_poster = await itemid.load(this.poster.id)
      }
    }
  }
</script>
<style lang="stylus">
  figure.feed.poster
    position: relative
    // overflow: hidden
    & >  menu
      display: flex
      justify-content: flex-end
      padding: base-line
      margin-top: -(base-line * 4)
      & > a > svg
        fill: red
    & > svg
      width: 100%
      height: 100%
      max-height: poster-feed-height
      &.background
        fill: blue
      &.working
        height: auto
        width: base-line * 5
      @media (max-width: pad-begins)
        &:not(.working)
          margin-left -(base-line)
          margin-right -(base-line)
</style>

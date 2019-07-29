’<template lang="html">
  <section id="profile" class="page" ref='profile'>
    <header>
      <svg></svg>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-avatar v-bind:by_reference="true" :person="person"></profile-as-avatar>
    <profile-as-figure :person='person'></profile-as-figure>
    <posts-as-list :posts='posts'></posts-as-list>
  </section>
</template>
<script>
  import profile_id from '@/modules/profile_id'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import posts_as_list from '@/components/posts/as-list'
  export default {
    components: {
      'profile-as-figure': profile_as_figure,
      'profile-as-avatar': profile_as_avatar,
      'posts-as-list': posts_as_list,
      'logo-as-link': logo_as_link
    },
    data() {
      return {
        working: true,
        person: {},
        posts: []
      }
    },
    mounted() {
      document.body.scrollTop = document.documentElement.scrollTop = 0
    },
    async created() {
      const id = profile_id.from_e64(this.$route.params.phone_number)
      this.person = await profile_id.load(id)
      this.posts = await profile_id.items(id, 'posts')
      this.working = false
    }
  }
</script>
<style lang='stylus'>
  section#profile
    & > header
      margin-bottom: -(base-line * 4)
      z-index: 2
      position: relative
      & > a
        -webkit-tap-highlight-color: blue
    & > figure
    & > div
      margin: auto
      max-width: page-width
      padding: base-line
      & > article.silent
        display: none
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
      fill: white
</style>

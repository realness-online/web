<template lang="html">
  <section id="profile" class="page" v-bind:class="{me}">
    <header>
      <profile-as-figure :person='person' :me="me" :view_avatar="true"></profile-as-figure>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <my-posts v-if="me"></my-posts>
    <posts-list v-else :posts='posts'></posts-list>
  </section>
</template>
<script>
  import '@/modules/timeago'
  import profileAsFigure from '@/components/profile/as-figure'
  import logoAsLink from '@/components/logo-as-link'
  import postsList from '@/components/posts/as-list'
  import myPosts from '@/components/posts/my-list'
  import icon from '@/components/icon'
  import profile from '@/modules/Profile'
  import profile_init from '@/mixins/profile_init'
  export default {
    mixins: [profile_init],
    components: {
      profileAsFigure,
      myPosts,
      postsList,
      logoAsLink,
      icon
    },
    data() {
      return {
        posts: []
      }
    },
    created() {
      const phone_number = this.$route.params.phone_number
      if (phone_number) {
        this.working = true
        profile.items(`/${phone_number}`, 'posts').then(items => {
          this.posts = items
          this.working = false
        })
      } else {
        this.working = false
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#profile
    header > a
      -webkit-tap-highlight-color: black
    & > svg.working
      margin-top: base-line
</style>

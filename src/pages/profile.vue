<template lang="html">
  <section id="profile" class="page" v-bind:class="{me}">
    <header>
      <profile-as-figure :person='person' :me="me" :previous="true"></profile-as-figure>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <my-posts v-if="me"></my-posts>
    <posts-list v-else :posts='posts'></posts-list>
  </section>
</template>
<script>
  import '@/modules/timeago'
  import {person_storage} from '@/modules/Storage'
  import profileAsFigure from '@/components/profile/as-figure'
  import logoAsLink from '@/components/logo-as-link'
  import postsList from '@/components/posts/as-list'
  import myPosts from '@/components/posts/my-list'
  import icon from '@/components/icon'
  import profile from '@/modules/Profile'
  export default {
    components: {
      profileAsFigure,
      myPosts,
      postsList,
      logoAsLink,
      icon
    },
    created() {
      const mobile = this.$route.params.mobile
      if (mobile) {
        console.log(mobile)
        profile.load(mobile).then(items => {
          this.working = false
          this.person = items[0]
        })
        profile.profile_items(mobile, 'posts').then(items => {
          this.posts = items
        })
      } else {
        this.me = true
        this.working = false
        this.person = person_storage.as_object()
      }
    },
    data() {
      return {
        me: false,
        working: true,
        person: {},
        posts: {}
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#profile > svg.working
    margin-top: base-line
</style>

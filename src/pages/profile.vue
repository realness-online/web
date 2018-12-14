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
    data() {
      return {
        me: false,
        working: true,
        person: {},
        posts: []
      }
    },
    created() {
      const phone_number = this.$route.params.phone_number
      if (phone_number) {
        const profile_id = `/${phone_number}`
        profile.load(profile_id).then(profile => {
          this.person = profile
        })
        profile.items(profile_id, 'posts').then(items => {
          this.posts = items
          this.working = false
        })
      } else {
        this.person = person_storage.as_object()
        this.me = true
        this.working = false
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#profile > svg.working
    margin-top: base-line
</style>

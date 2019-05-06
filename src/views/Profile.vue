<template lang="html">
  <section id="profile" class="page" ref='profile'>
    <profile-as-avatar v-if="!is_me" v-bind:by_reference="true" :person="person"></profile-as-avatar>
    <header>
      <profile-as-figure :person='person'></profile-as-figure>
      <logo-as-link></logo-as-link>
    </header>
    <footer>
      <h1>Posts</h1>
      <my-posts v-if="is_me"></my-posts>
      <posts-list v-else :posts='posts'></posts-list>
    </footer>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import '@/modules/time_ago'
  import profile_id from '@/modules/profile_id'
  import { person_storage, posts_storage } from '@/modules/Storage'
  import profileAsFigure from '@/components/profile/as-figure'
  import profileAsAvatar from '@/components/profile/as-avatar'
  import logoAsLink from '@/components/logo-as-link'
  import postsList from '@/components/posts/as-list'
  import myPosts from '@/components/posts/my-list'
  export default {
    components: {
      profileAsFigure,
      profileAsAvatar,
      myPosts,
      postsList,
      logoAsLink
    },
    data() {
      return {
        working: true,
        person: {},
        posts: []
      }
    },
    created() {
      const phone_number = this.$route.params.phone_number
      if (phone_number) {
        this.load_from_network(phone_number)
      } else {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            // this.load_from_local()
            this.load_from_network(user.phoneNumber)
          } else {
            this.load_from_local()
          }
        })
      }
    },
    methods: {

      load_from_network(phone_number) {
        const id = `/${phone_number}`
        profile_id.load(id).then(profile => {
          this.person = profile
        })
        profile_id.items(id, 'posts').then(items => {
          this.posts = items
          this.working = false
        })
      },
      load_from_local() {
        this.person = person_storage.as_object()
        this.posts = posts_storage.as_list()
        this.working = false
      }
    },
    computed: {
      is_me() {
        return person_storage.as_object().id === this.person.id
      }
    }
  }
</script>
<style lang='stylus'>
  section#profile
    & > header
    & > footer
      margin: auto
      max-width: page-width
    & > footer
      padding: 0 base-line
    & > header > a
      -webkit-tap-highlight-color: blue
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
      fill: blue
</style>

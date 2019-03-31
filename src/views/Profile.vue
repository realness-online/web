<template lang="html">
  <section id="profile" class="page">
    <header>
      <profile-as-figure :person='person' :click_to_avatar="true"></profile-as-figure>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <my-posts v-if="is_me"></my-posts>
    <posts-list v-else :posts='posts'></posts-list>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import '@/modules/time_ago'
  import profile_id from '@/modules/profile_id'
  import { person_storage, posts_storage } from '@/modules/Storage'
  import profileAsFigure from '@/components/profile/as-figure'
  import logoAsLink from '@/components/logo-as-link'
  import postsList from '@/components/posts/as-list'
  import myPosts from '@/components/posts/my-list'
  import icon from '@/components/icon'
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
        working: true,
        person: {},
        posts: []
      }
    },
    created() {
      let phone_number = this.$route.params.phone_number

      if (phone_number) {
        this.load_from_network(phone_number)
      } else {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
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
  @require '../style/variables'
  section#profile
    header > a
      -webkit-tap-highlight-color: black
    & > svg.working
      margin-top: base-line
</style>

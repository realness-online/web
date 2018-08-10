<template lang="html">
  <section id="profile" class="page" v-bind:class="{me}">
    <header>
      <profile-as-figure :person='person' :me="me" :previous="true"></profile-as-figure>
      <icon v-show="working" name="working"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <my-posts v-if="me"></my-posts>
    <posts-list v-else :posts='posts'></posts-list>
  </section>
</template>
<script>
  import '@/modules/timeago'
  import Item from '@/modules/Item'
  import Storage, {person_storage} from '@/modules/Storage'
  import profileAsFigure from '@/components/profile/as-figure'
  import logoAsLink from '@/components/logo-as-link'
  import postsList from '@/components/posts/as-list'
  import myPosts from '@/components/posts/my-list'
  import icon from '@/components/icon'
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
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
        this.get_items(mobile, 'person').then(items => {
          this.working = false
          this.person = items[0]
        })
        this.get_items(mobile, 'posts').then(items => (this.posts = items))
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
    },
    methods: {
      get_url(mobile, type) {
        const path = `/people/+1${mobile}/${type}.html`
        return firebase.storage().ref().child(path).getDownloadURL()
      },
      get_items(mobile, type) {
        return new Promise((resolve, reject) => {
          this.get_url(mobile, type).then((url) => {
            fetch(url).then(response => {
              response.text().then((server_text) => {
                const server_as_fragment = Storage.hydrate(server_text)
                resolve(Item.get_items(server_as_fragment))
              })
            })
          })
        })
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#profile
    figure.profile svg
      standard-border: black
    &.me
      figure.profile svg
        standard-button: black
        padding:0
    & > svg.working
      margin-top: base-line
</style>

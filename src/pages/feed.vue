<template>
  <section id="feed" class="page left">
    <header>
      <icon name="hamburger"></icon>
      <h1>Feed</h1>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-show="working" name="working"></icon>
    <article v-for="post in feed" itemscope itemtype="/post">
      <header>
        <profile-as-figure :person='post.person'></profile-as-figure>
      </header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
    </article>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import Storage, {relations_storage} from '@/modules/Storage'
  import Item from '@/modules/Item'
  import logoAsLink from '@/components/logo-as-link'
  import profileAsFigure from '@/components/profile/as-figure'
  import icon from '@/components/icon'
  export default {
    components: {
      profileAsFigure,
      logoAsLink,
      icon
    },
    data() {
      return {
        feed: [],
        working: true
      }
    },
    methods: {
      posts_url(person) {
        let posts_path = `/people/+1${person.mobile}/posts.html`
        return firebase.storage().ref().child(posts_path).getDownloadURL()
      }
    },
    created() {
      relations_storage.as_list().forEach((person) => {
        this.posts_url(person).then((url) => {
          fetch(url).then((response) => {
            response.text().then(text => {
              let posts = Item.get_items(Storage.hydrate(text))
              posts.forEach(post => (post.person = person))
              this.feed.push(...posts)
              this.feed.sort((a, b) => {
                return Date.parse(b.created_at) - Date.parse(a.created_at)
              })
              this.working = false
            })
          })
        })
      })
    }
  }
  // check if their updated since last time.
  // if their are new updates then update Feed
  // this requires that posts update the updated at property for each person
  // when they create a post
  // let profile_path = `/people/+1${person.mobile}/profile.html`
  // this.get_item_by_path(relations_path).then((network_person) => {
  //   if (network_person.updated_at > person.updated_at){
  //
  //     console.log('getting updates for:', person.first_name)
  //
  //   }
</script>
<style lang="stylus">
  @require '../style/variables'
  section#feed
    display: flex
    flex-direction: column-reverse
    & > header
      order: 2
      margin-bottom: base-line
      & > svg
        fill: transparent
    & > svg.working
      order: 1
      margin-bottom: base-line
    & > article
      margin-bottom: base-line
      & > header
        margin-bottom: (base-line / 2)
        & > figure a svg
          fill: blue
          stroke: lighten(blue, 33%)
          border-radius: base-line
      & > blockquote
        margin-bottom: (base-line / 2)
</style>

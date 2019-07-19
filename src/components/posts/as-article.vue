<template lang="html">
  <article  :key="item_id(post)" itemscope itemtype="/post" :itemid="item_id(post)">
    <router-link :to="post.person.id">
      <profile-as-avatar :person="post.person" :by_reference="true"></profile-as-avatar>
    </router-link>
    <hgroup>
      <span>{{post.person.first_name}} {{post.person.last_name}}</span>
      <time itemprop="created_at" :datetime="post.created_at">{{created_time(post.created_at)}}</time>
    </hgroup>
    <blockquote itemprop="statement" v-for="statement in post.statements" >{{statement.articleBody}}</blockquote>
    <blockquote itemprop="statement" >{{post.articleBody}}</blockquote>
  </article>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import profile_as_avatar from '@/components/profile/as-avatar'
  export default {
    mixins: [posts_into_days],
    components: {
      'profile-as-avatar': profile_as_avatar,
    },
    props: {
      post: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        observer: null
      }
    },
    mounted(){
      console.log(this.post.person.oldest_post);
      if (this.post.created_at === this.post.person.oldest_post) {
        this.observer = new IntersectionObserver(this.end_of_posts, {})
        this.observer.observe(this.$el)
      }
    },
    methods: {
      end_of_posts(entries) {
        console.log('end_of_posts', entries)
      },
      item_id(post) {
        return `${post.person.id}/${post.created_at}`
      },
    }
  }
</script>
<style lang="stylus">
</style>

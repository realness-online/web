<template lang="html">
  <article  :key="item_id(post)" itemscope itemtype="/post" :itemid="item_id(post)">
    <router-link :to="post.person.id">
      <profile-as-avatar :person="post.person" :by_reference="true"></profile-as-avatar>
    </router-link>
    <hgroup>
      <span>{{post.person.first_name}} {{post.person.last_name}}</span>
      <time itemprop="created_at" :datetime="post.created_at">{{created_time(post.created_at)}}</time>
    </hgroup>
    <blockquote itemprop="statement" v-for="statement in post.statements" :key="statement.created_at" >{{statement.articleBody}}</blockquote>
    <blockquote itemprop="statement" >{{post.articleBody}}</blockquote>
  </article>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import profile_as_avatar from '@/components/profile/as-avatar'
  export default {
    mixins: [posts_into_days],
    components: {
      'profile-as-avatar': profile_as_avatar
    },
    props: {
      post: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        observer: null,
        oldest: this.post.person.oldest_post
      }
    },
    mounted() {
      if (this.i_am_oldest) {
        // console.log('observe me', this.post);
        this.$nextTick(_ => {
          this.observer = new IntersectionObserver(this.end_of_posts, {})
          this.observer.observe(this.$el)
        })
      }
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    computed: {
      i_am_oldest() {
        if (this.post.created_at === this.oldest) return true;
        else {
          return this.post.statements.some(statement => {
            if (statement.created_at === this.oldest) return true;
            else return false;
          })
        }
      }
    },
    methods: {
      end_of_posts(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.$emit('next-page', this.post.person)
            this.observer.unobserve(this.$el)
          }
        })
      },
      item_id(post) {
        return `${post.person.id}/${post.created_at}`
      }
    }
  }
</script>
<style lang="stylus">
  article[itemtype='/post']
    overflow: hidden
    margin-bottom: base-line
    &:last-of-type
      margin-bottom: 0
    & > hgroup
      font-weight: 200
      & > span
      & > time
        display: inline-block
        vertical-align: center
      & > span
        color: black
      & > time
        color: black
        margin-left: (base-line / 6)
    & > blockquote
      margin-bottom: base-line
      &:last-of-type
        margin-bottom: 0
    & > a > svg
      float: left
      margin-right: base-line
      shape-outside: circle()
      clip-path: circle(44%)
      fill: blue
      stroke: lighten(blue, 33%)
      stroke-width: 2px
</style>

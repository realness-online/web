<template lang="html">
  <article class="feed activity">
    <router-link :to="person.id">
      <profile-as-avatar :person="person" :by_reference="true"></profile-as-avatar>
    </router-link>
    <hgroup>
      <span>{{person.first_name}} {{person.last_name}}</span>
      <time :datetime="post.created_at">{{created_time}}</time>
    </hgroup>
    <p>{{as_statement}}</p>
    <p v-for="statement in post.statements" :key="statement.id" >{{as_statement(post)}}</p>
  </article>
</template>
<script>
  import posts_into_days from '@/mixins/posts_into_days'
  import date_formating from '@/mixins/date_formating'
  import post_mixin from '@/mixins/post'
  import profile_as_avatar from '@/components/profile/as-avatar'
  export default {
    mixins: [post_mixin, date_formating, posts_into_days],
    components: {
      'profile-as-avatar': profile_as_avatar
    },
    data() {
      return {
        observer: null
      }
    },
    mounted() {
      if (this.i_am_oldest) {
        this.observer = new IntersectionObserver(this.end_of_posts, {})
        this.$nextTick(_ => this.observer.observe(this.$el))
      }
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    methods: {
      end_of_posts(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.$emit('next-page', this.person)
            this.observer.unobserve(this.$el)
          }
        })
      }
    }
  }
</script>
<style lang="stylus">
  article.feed.activity
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
      & > time
        margin-left: (base-line / 6)
    & > blockquote
      margin-bottom: base-line
      &:last-of-type
        margin-bottom: 0
    & > a > svg
      float: left
      margin-right: (base-line / 2)
      shape-outside: circle()
      clip-path: circle(44%)
      fill: blue
</style>

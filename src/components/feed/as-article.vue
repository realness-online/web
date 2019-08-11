<template lang="html">
  <article class="feed activity">
    <router-link :to="person.id">
      <profile-as-avatar :person="person" :by_reference="true"></profile-as-avatar>
    </router-link>
    <hgroup>
      <span>{{person.first_name}} {{person.last_name}}</span>
      <time :datetime="post.created_at">{{as_created_time}}</time>
    </hgroup>
    <p>{{as_statement}}</p>
    <p v-for="statement in post.statements" :key="statement.id" >{{as_statement_from_post(statement)}}</p>
  </article>
</template>
<script>
  import post_mixin from '@/mixins/post'
  import date_mixin from '@/mixins/date'
  import profile_as_avatar from '@/components/profile/as-avatar'
  export default {
    mixins: [post_mixin, date_mixin],
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
        this.observer = new IntersectionObserver(this.end_of_articles, {})
        this.$nextTick(_ => this.observer.observe(this.$el))
      }
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    methods: {
      end_of_articles(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.$emit('end-of-articles', this.person)
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

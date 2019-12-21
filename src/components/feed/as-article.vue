<template lang="html">
  <article class="feed post">
    <header>
      <router-link :to="person.id">
        <profile-as-avatar :person="person"></profile-as-avatar>
      </router-link>
      <hgroup>
        <span>{{person.first_name}} {{person.last_name}}</span>
        <time :datetime="post.created_at">{{as_created_time}}</time>
      </hgroup>
    </header>
    <p>{{as_statement}}</p>
    <p v-for="statement in post.statements" :key="statement.id" >{{as_statement_from_post(statement)}}</p>
  </article>
</template>
<script>
  import post_mixin from '@/mixins/post'
  import date_mixin from '@/mixins/date'
  import intersection_mixin from '@/mixins/intersection'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    mixins: [post_mixin, date_mixin, intersection_mixin],
    components: {
      'profile-as-avatar': profile_as_avatar
    }
  }
</script>
<style lang="stylus">
  article.feed.post
    overflow: hidden
    margin-bottom: base-line
    &:last-of-type
      margin-bottom: 0
</style>

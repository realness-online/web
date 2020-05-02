<template lang="html">
  <article class="thought">
    <header v-if="show_author">
      <router-link :to="person.id">
        <profile-as-avatar :person="person.id"></profile-as-avatar>
      </router-link>
      <hgroup>
        <span>{{person.first_name}} {{person.last_name}}</span>
        <time :datetime="post.created_at">{{as_created_time}}</time>
      </hgroup>
    </header>
    <header v-else>
      <time>{{as_created_time}}</time>
    </header>
    <as-statements v-for="statement in statements" :statement="statement"></as-statements>
  </article>
</template>
<script>
  import as_statment from '@/components/posts/as-statement'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    components: {
      'profile-as-avatar': profile_as_avatar,
      'as-statment': as_statment
    },
    props: {
      statements: {
        type: Array,
        required: true
      }
    },
    computed: {
      as_created_time() {
        get_created_at(this.statements[0])
      }
    }
  }
</script>
<style lang='stylus'>
  article[itemtype="/posts"]
    overflow: hidden
    & > header
      margin-bottom: (base-line / 2)
</style>

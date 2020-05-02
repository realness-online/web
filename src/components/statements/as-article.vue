<template lang="html">
  <article class="thought">
    <header v-if="verbose">
      <router-link :to="author.id">
        <profile-as-avatar :person="author"></profile-as-avatar>
      </router-link>
      <hgroup>
        <span>{{ author.first_name }}</span>
        <span>{{ author.last_name }}</span>
        <time>{{ thought_starts_at }}</time>
      </hgroup>
    </header>
    <header v-else><time>{{thought_starts_at}}</time></header>
    <as-statement v-for="statement in statements" :statement="statement"></as-statement>
  </article>
</template>
<script>
  import date_helper from '@/helpers/date'
  import as_statement from '@/components/statements/as-div'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    components: {
      'profile-as-avatar': profile_as_avatar,
      'as-statement': as_statement
    },
    props: {
      statements: {
        type: Array,
        required: true
      },
      verbose: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data() {
      return {
        author: {}
      }
    },
    async created() {
      if (this.verbose) {
        const author_id = itemid.get_author(this.statement.id)
        this.author = await itemid.load(author_id)
      }
    },
    computed: {
      thought_starts_at() {
        return date_helper.as_time(get_created_at(this.statements[0].id))
      }
    }
  }
</script>
<style lang='stylus'>
  article.thought
    overflow: hidden
    & > header
      margin-bottom: (base-line / 2)
</style>

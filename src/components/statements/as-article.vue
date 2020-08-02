<template lang="html">
  <article class="thought">
    <header v-if="author">
      <router-link :to="author.id">
        <profile-as-avatar :person="author" />
      </router-link>
      <hgroup>
        <span>{{ author.first_name }}</span>
        <span>{{ author.last_name }}</span>
        <time>{{ thought_starts_at }}</time>
      </hgroup>
    </header>
    <header v-else>
      <time>{{ thought_starts_at }}</time>
    </header>
    <as-statement v-for="statement in statements"
                  :key="statement.id"
                  itemprop="statements"
                  :statement="statement"
                  :editable="editable"
                  @focused="has_focus"
                  @blurred="has_blurred" />
  </article>
</template>
<script>
  import { load, as_author, as_created_at } from '@/helpers/itemid'
  import date_helper from '@/helpers/date'
  import intersection from '@/mixins/intersection'
  import as_statement from '@/components/statements/as-div'
  import profile_as_avatar from '@/components/avatars/as-svg'
  export default {
    components: {
      'profile-as-avatar': profile_as_avatar,
      'as-statement': as_statement
    },
    mixins: [intersection],
    props: {
      statements: {
        type: Array,
        required: true
      },
      verbose: {
        type: Boolean,
        required: false,
        default: false
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data () {
      return {
        author: null,
        focused: false
      }
    },
    computed: {
      thought_starts_at () {
        const created_at = as_created_at(this.statements[0].id)
        if (created_at) return date_helper.as_time(created_at)
        else return null
      }
    },
    async created () {
      if (this.verbose) {
        this.author = await load(as_author(this.statements[0].id))
      }
    },
    methods: {
      show () {
        this.$emit('show', this.statements)
      },
      has_focus (statement) {
        this.focused = true
        this.$emit('focused', statement)
      },
      has_blurred (statement) {
        this.focused = false
        setTimeout(() => {
          if (!this.focused) {
            this.$emit('blurred', statement)
          }
        }, 750)
      }
    }
  }
</script>
<style lang='stylus'>
  article.thought
    overflow: hidden
    & > header
      display: flex
      justify-content: flex-start
      flex-direction: row
      margin: 0 0 base-line 0
      & a > svg
        cursor: pointer
        shape-outside: circle()
        border-radius: base-line
        margin-right: round((base-line / 4), 2)
      & > hgroup
        margin: 0
        & > span
          margin-right: round((base-line / 4), 2)
          font-weight: 300
          display: inline-block
</style>

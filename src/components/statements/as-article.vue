<template lang="html">
  <article class="thought">
    <header v-if="author">
      <router-link :to="author.id">
        <as-avatar :person="author" />
      </router-link>
      <hgroup>
        <span>{{ author.first_name }}</span>
        <span>{{ author.last_name }}</span>
        <time>{{ thought_starts_at }}</time>
      </hgroup>
      <menu>
        <as-messenger :itemid="author.id" />
      </menu>
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
  import { as_time } from '@/helpers/date'
  import intersection from '@/mixins/intersection'
  import as_statement from '@/components/statements/as-div'
  import as_avatar from '@/components/avatars/as-svg'
  import as_messenger from '@/components/profile/as-messenger'
  export default {
    components: {
      'as-avatar': as_avatar,
      'as-messenger': as_messenger,
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
        return as_time(as_created_at(this.statements[0].id))
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
      & > a > svg
        cursor: pointer
        shape-outside: circle()
        border-radius: (base-line * 2)
        margin-right: round((base-line / 4), 2)
      & > hgroup
        flex:1
        margin: 0
        & > span
          margin-right: round((base-line / 4), 2)
          font-weight: 300
          display: inline-block
      & > menu > a > svg
        fill: blue
        opacity: .25
        &:hover
        &:active
          opacity: 1
</style>

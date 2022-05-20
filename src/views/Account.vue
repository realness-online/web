<template>
  <section id="account" :class="{ 'signed-in': current_user }" class="page">
    <header>
      <router-link to="/settings" tabindex="-1">
        <icon name="gear" />
      </router-link>
      <logo-as-link />
    </header>
    <address v-if="current_user && !working">
      <profile-as-figure
        v-if="person"
        v-model:person="person"
        :editable="true"
        @update:person="emit('update:person', person)" />
    </address>
    <h1 v-if="!working">Statements</h1>
    <as-days
      v-slot="thoughts"
      itemscope
      :itemid="item.id"
      :paginate="false"
      :statements="statements">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought"
        :editable="is_editable(thought)"
        @show="thought_shown"
        @focused="thought_focused"
        @blurred="thought_blurred" />
    </as-days>
    <footer
      v-if="statements && statements.length === 0 && !working"
      class="message">
      <p>
        Say some stuff via the <button aria-label="Home" @click="home" /> button
        on the homepage
        <br />
      </p>
    </footer>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import ProfileAsFigure from '@/components/profile/as-figure'
  import ThoughtAsArticle from '@/components/statements/as-article'

  import { current_user, sign_off } from '@/use/serverless'
  import { use as use_statements } from '@/use/statements'
  import { use as use_person } from '@/use/people'

  import { ref, onMounted as mounted } from 'vue'
  import { useRouter as use_router } from 'vue-router'

  const emit = defineEmits(['update:person'])
  const pages_viewed = ref(['index'])
  const settings = ref(false)
  const working = ref(true)
  const currently_focused = ref(null)
  const router = use_router()
  const me = {
    id: localStorage.me,
    type: 'person'
  }
  const {
    my_statements,
    statements,
    thought_shown,
    for_person: statements_for_person
  } = use_statements()
  const { person, load_person } = use_person()
  const is_editable = thought => {
    if (working.value) return false
    return thought.some(statement =>
      my_statements.value.some(s => s.id === statement.id)
    )
  }
  const signoff = () => {
    sign_off()
    router.push({ path: '/sign-on' })
  }
  const home = () => router.push({ path: '/' })
  const thought_focused = async statement => {
    currently_focused.value = statement.id
    // await load_thoughts()
    pages_viewed.value = ['index']
  }
  const thought_blurred = statement => {
    if (currently_focused.value === statement.id) {
      currently_focused.value = null
      const oldest = statements.value[statements.value.length - 1]
      thought_shown([oldest])
    }
  }
  mounted(async () => {
    await Promise.all([load_person(me), statements_for_person(me)])
    working.value = false
    console.info('views:Account')
  })
</script>
<style lang="stylus">
  section#account
    svg.icon
      fill: red
    a
    button
    time
      color: red
      border-color: red
    &.signed-in
      padding-top: 0
      & > h1
        margin-top: base-line
      // & > header
      //   height: 0
      //   padding: 0
    & > header
      & > button.sign-on
      & > a#logo
        position: absolute
        top: inset(top, 1.75em)
        right: inset(right)
        z-index: 2
      & > button.sign-on
        width: base-line * 4
        left: inset(left)
        height: round(base-line * 2, 2)
    & > address
      position: relative
      z-index: 1
      & > figure
        padding: inset(top, base-line) base-line 0 base-line
        & > svg
          width: base-line * 2
          height: base-line * 2
          min-height: inherit
          border-radius: base-line * 2
          border-color: red
        & > figcaption
          padding: 0
          & > address
            flex-direction: row
            align-items: center
            & > b
              color: red
              margin-bottom: 0
          & > menu
            margin-right: base-line * 2.25
            justify-content: center
            opacity: 1
            padding: 0
            & > a > svg.gear
              fill: red
              animation-name: rotate-back
              transform-origin: center
              transition-duration: 0.1s
              animation-iteration-count: 0.1
              transition-timing-function: ease-in-out
              &:active
                transition-timing-function: ease-in-out
                animation-name: rotate
                animation-iteration-count: 0.5
      & > menu
        float:right
        width: 6rem
        margin: base-line * 2 0
        display:flex
        justify-content: space-between
        animation-name: fade-in
        animation-duration: 0.2s

        & > button:hover
          transition: color
          transition-duration: 0.5s
          color: hsla(353, 83%, 57%, 1) // #ec364c
      & > button
        position: absolute
        bottom: .05rem
        right: 1em
    & > h1
      margin-top: base-line * 2
      padding: base-line
    & > section.as-days
      padding-top: 0
      h4
        margin: base-line 0 0 0
      article.day p[itemprop="statement"]:focus
        font-weight: bolder
        outline: 0px
    & > footer
      text-align: center
      padding: 0 base-line
      & > p
        max-width: inherit
        & > button
          background-color: red
          border-width: 1px
          border-radius: 0.2em
          height: 1em
          width: 1.66em
    @media (prefers-color-scheme: dark)
      h1, h4, svg.background
        color: red
        fill: red
</style>

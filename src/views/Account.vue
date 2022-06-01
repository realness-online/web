<template>
  <section id="account" :class="{ 'signed-in': current_user }" class="page">
    <header>
      <router-link to="/settings" tabindex="-1">
        <icon name="gear" />
      </router-link>
      <logo-as-link />
    </header>
    <h1 v-if="!working">Statements</h1>
    <as-days
      v-slot="thoughts"
      itemscope
      :itemid="get_my_itemid('statements')"
      :paginate="false"
      :statements="my_statements">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought"
        :editable="true" />
    </as-days>

    <footer
      v-if="my_statements && my_statements.length === 0 && !working"
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
  import ThoughtAsArticle from '@/components/statements/as-article'

  import { current_user } from '@/use/serverless'
  import { use as use_statements } from '@/use/statements'
  import { get_my_itemid } from '@/use/people'

  import { ref, onMounted as mounted } from 'vue'
  import { useRouter as use_router } from 'vue-router'
  const working = ref(true)
  const router = use_router()
  const { my_statements } = use_statements()
  const home = () => router.push({ path: '/' })

  mounted(async () => {
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

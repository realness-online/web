<template>
  <section id="statements" :class="{ 'signed-in': current_user }" class="page">
    <header>
      <icon name="nothin" />
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
    console.info('views:Statements')
  })
</script>
<style lang="stylus">
  section#statements
    svg.icon
      fill: red
    a
    button
    time
      color: red
      border-color: red

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

<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/thoughts/as-article'

  import { current_user } from '@/utils/serverless'
  import { use as use_thoughts } from '@/use/thought'
  import { get_my_itemid } from '@/use/people'

  import { ref, onMounted as mounted } from 'vue'
  import { useRouter as use_router } from 'vue-router'
  import { use_keymap } from '@/use/key-commands'
  import { storytelling } from '@/utils/preference'

  console.time('views:Thoughts')
  const working = ref(true)
  const router = use_router()
  const { my_thoughts, thoughts, statement_shown } = use_thoughts()
  const home = () => router.push({ path: '/' })

  const { register } = use_keymap('Thoughts')

  register('thought::Save', () => {})
  register('thought::Cancel', () => {})

  mounted(() => {
    const last_editable = my_thoughts.value.length - 1
    thoughts.value = [my_thoughts.value[last_editable]]
    working.value = false
    console.timeEnd('views:Thoughts')
  })
</script>

<template>
  <section
    id="thoughts"
    :class="{ 'signed-in': current_user, storytelling }"
    class="page">
    <header>
      <icon name="nothin" />
      <logo-as-link />
    </header>
    <article class="editable thoughts">
      <header>
        <h1 v-if="!working">Thoughts</h1>
      </header>
      <as-days
        v-slot="day_thoughts"
        itemscope
        :itemid="get_my_itemid('thoughts')"
        :paginate="false"
        :thoughts="my_thoughts">
        <thought-as-article
          v-for="stmt in day_thoughts"
          :key="stmt[0].id"
          :statements="stmt"
          editable
          @show="statement_shown" />
      </as-days>
    </article>
    <footer v-if="!my_thoughts?.length && !working" class="message">
      <p>
        Say some stuff via the <button aria-label="Home" @click="home" /> button
        on the homepage
        <br />
      </p>
    </footer>
    <article v-if="thoughts?.length > 1" class="earlier thoughts">
      <header>
        <h1>Earlier Thoughts</h1>
      </header>
      <as-days v-slot="day_thoughts" :thoughts="thoughts" :paginate="false">
        <thought-as-article
          v-for="stmt in day_thoughts"
          :key="stmt[0].id"
          :statements="stmt"
          @show="statement_shown" />
      </as-days>
    </article>
  </section>
</template>

<style lang="stylus">
  section#thoughts
    svg.icon
      fill: red
    a
    button
    time
      color: red
      border-color: red
    & > article.thoughts
      &.earlier .day:first-of-type
        display: none
      & > header
        h1
          width: 100%
          margin-top: 0
          text-align: center
          padding: 0 base-line base-line base-line
          line-height: 1
      & > section.as-days
        padding-top: 0
        h4
          margin: base-line 0 0 0
        article.day p[itemprop="thought"]:focus
          font-weight: bolder
          outline: 0px
    & > footer
      text-align: center
      padding: 0 base-line
      & > p
        margin: auto
        max-width: inherit
        & > button
          background: red
          border-width: 1px
          border-radius: 0.2em
          height: 1em
          width: 1.66em
    @media (prefers-color-scheme: dark)
      h1, h4, svg.background
        color: red
        fill: red
</style>

<template>
  <section id="relations" class="page">
    <header>
      <button v-if="current_user" @click="sign_off">Sign off</button>
      <sign-on v-else />
      <h1>Relations</h1>
      <router-link to="/phonebook">
        <icon name="finished" />
      </router-link>
    </header>
    <nav v-if="current_user" class="profile-list">
      <as-figure v-for="person in people" :key="person.id" :person="person" />
    </nav>
  </section>
</template>
<script setup>
  import Icon from '@/components/icon'
  import AsFigure from '@/components/profile/as-figure'
  import SignOn from '@/components/profile/sign-on'
  import { current_user, sign_off } from '@/use/serverless'
  import { onMounted as mounted } from 'vue'

  import { use_me, use as use_people } from '@/use/people'

  const { people, load_people } = use_people()
  const { relations } = use_me()

  mounted(async () => {
    await load_people(relations.value)
    console.info('views:Relations')
  })
</script>
<style lang="stylus">
  section#relations
    padding-bottom: base-line * 2
    & > header
      margin: auto
      svg
        &.finished
          fill: blue
        &.working
          margin-bottom: base-line
    & > nav
      margin-top: base-line * 2
      & address > h3
        max-width: base-line * 6
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
</style>

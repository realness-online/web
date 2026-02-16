<script setup>
  import Icon from '@/components/icon'
  import AsFigure from '@/components/profile/as-figure'
  import { onMounted as mounted } from 'vue'
  import { use_me, use as use_people } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  const { people, load_people } = use_people()
  const { relations } = use_me()

  mounted(async () => {
    await load_people(relations.value)
  })
</script>

<template>
  <section id="relations" class="page">
    <header>
      <icon name="nothin" />
      <router-link to="/phonebook">
        <icon name="finished" />
      </router-link>
    </header>
    <h1>Relations</h1>
    <nav v-if="current_user" class="profile-list">
      <as-figure v-for="person in people" :key="person.id" :person="person" />
    </nav>
  </section>
</template>

<style lang="stylus">
  section#relations
    padding-bottom: base-line * 2
    & > h1
      color: blue
      text-align: center
    & > header
      margin: auto
      button
        font-size: 88%
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

<template>
  <section id="relations" class="page">
    <header>
      <app-icon name="nothing" />
      <h1>Relations</h1>
      <router-link to="/phone-book">
        <app-icon name="finished" />
      </router-link>
    </header>
    <nav v-if="current_user" class="profile-list">
      <as-figure
        v-for="person in relations"
        :key="person.id"
        v-model:relations="relations"
        :person="person" />
    </nav>
  </section>
</template>
<script setup>
  import AppIcon from '@/components/icon'
  import AsFigure from '@/components/profile/as-figure'
  import { list, load } from '@/use/itemid'
  import { onMounted as mounted, ref } from 'vue'
  import { use } from '@/use/people'
  import { current_user } from '@/use/serverless'
  const { relations, load_relations } = use()
  mounted(async () => {
    await load_relations({ id: localStorage.me })
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

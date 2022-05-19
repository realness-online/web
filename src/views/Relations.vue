<template>
  <section id="relations" class="page">
    <header>
      <icon name="nothing" />
      <h1>Relations</h1>
      <router-link to="/phonebook">
        <icon name="finished" />
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
  import icon from '@/components/icon'
  import AsFigure from '@/components/profile/as-figure'
  import { ref, onMounted as mounted } from 'vue'
  import { load } from '@/use/itemid'
  import { use_me } from '@/use/people'
  import { current_user } from '@/use/serverless'
  const { relations: stubbed_relations } = use_me()
  const relations = ref([])
  mounted(async () => {
    stubbed_relations.value.map(async relation => {
      const loaded_relation = await load(relation.id)
      relations.value.push(loaded_relation)
    })
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

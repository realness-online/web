<script setup>
  import { provide, watch, nextTick as tick } from 'vue'
  import AsDays from '@/components/as-days'
  import EventsList from '@/components/events/as-list'
  import UnsyncedPoster from '@/components/posters/as-svg'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import AsAddress from '@/components/profile/as-address'
  import ProfileAsMeta from '@/components/profile/as-meta'
  import { use as use_sync } from '@/use/sync'
  import { use as use_statements } from '@/use/statements'
  import { use as use_people, use_me, get_my_itemid } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  const emit = defineEmits(['active', 'refreshed'])
  const { me, relations, save } = use_me()

  watch(
    () => !!current_user.value && !!me.value?.id,
    async should_persist => {
      if (!should_persist) return
      await tick()
      await save()
    },
    { immediate: true }
  )
  const { my_statements: my_editable_statements, update_statement } =
    use_statements()
  const { load_phonebook } = use_people()
  const {
    events,
    sync_element: sync,
    sync_poster
  } = use_sync(emit, {
    load_phonebook
  })
  provide('update_statement', update_statement)
  provide('sync_element', sync)
</script>

<template>
  <aside ref="sync" hidden>
    <as-address v-if="me" :person="me" />
    <profile-as-meta v-if="relations" :people="relations" />
    <as-days
      v-if="my_editable_statements"
      v-slot="{ day }"
      itemscope
      :itemid="get_my_itemid('statements')"
      :statements="my_editable_statements"
      :paginate="false">
      <thought-as-article
        v-for="stmt in day"
        :key="stmt[0].id"
        :statements="stmt" />
    </as-days>
    <events-list
      v-if="events"
      :events="events"
      :itemid="get_my_itemid('events')" />
    <unsynced-poster
      v-if="sync_poster"
      :sync_poster="sync_poster"
      :itemid="sync_poster.id" />
  </aside>
</template>

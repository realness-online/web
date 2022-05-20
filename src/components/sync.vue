<template>
  <aside ref="sync" hidden>
    <as-address v-if="me" :person="me" />
    <as-days
      v-if="my_editable_statements"
      v-slot="thoughts"
      itemscope
      :itemid="get_my_itemid('statements')"
      :statements="my_editable_statements"
      :paginate="false">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought" />
    </as-days>
    <events-list
      v-if="events"
      :events="events"
      :itemid="get_my_itemid('events')" />
    <unsynced-poster
      v-if="poster"
      :key="poster.id"
      :itemid="poster.id"
      :poster="poster"
      :immediate="true" />
  </aside>
</template>

<script setup>
  import AsDays from '@/components/as-days'
  import EventsList from '@/components/events/as-list'
  import UnsyncedPoster from '@/components/posters/as-svg'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import AsAddress from '@/components/profile/as-address'

  import { onMounted as mounted, watch } from 'vue'
  import { load } from '@/use/itemid'
  import { from_e64 } from '@/use/people'
  import { current_user } from '@/use/serverless'
  import { use as use_sync } from '@/use/sync'
  import { use as use_statements } from '@/use/statements'
  import { use_me, get_my_itemid } from '@/use/people'

  const emit = defineEmits(['active'])
  const { me } = use_me()
  const { my_statements: my_editable_statements } = use_statements()
  const { poster, events, sync_element: sync } = use_sync()
</script>

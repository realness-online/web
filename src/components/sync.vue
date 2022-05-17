<template>
  <div ref="sync" hidden>
    <as-address v-if="person" :person="person" />
    <as-days
      v-if="statements"
      v-slot="thoughts"
      itemscope
      :itemid="get_itemid('statements')"
      :statements="statements"
      :paginate="false">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought" />
    </as-days>
    <events-list
      v-if="events"
      :events="events"
      :itemid="get_itemid('events')" />
    <unsynced-poster
      v-if="poster"
      :key="poster.id"
      :itemid="poster.id"
      :poster="poster"
      :immediate="true" />
  </div>
</template>

<script setup>
  import AsDays from '@/components/as-days'
  import EventsList from '@/components/events/as-list'
  import UnsyncedPoster from '@/components/posters/as-svg'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import AsAddress from '@/components/profile/as-address'
  import { load } from '@/use/itemid'
  import { from_e64 } from '@/use/people'
  import {
    use as use_sync,
    get_itemid,
    visit_interval
  } from '@/persistance/Cloud.sync'
  import { current_user } from '@/use/serverless'
  import { onMounted as mounted, watch } from 'vue'
  const props = defineProps({
    statement: {
      type: Object,
      required: false,
      default: null
    },
    person: {
      type: Object,
      required: false,
      default: null
    }
  })
  const emit = defineEmits(['update:statement', 'update:person', 'active'])
  const { sync, statements, poster, events, person } = use_sync(props, emit)
</script>

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
    <unsynced-poster v-if="sync_poster" :sync="true" :itemid="sync_poster.id" />
  </aside>
</template>

<script setup>
  import AsDays from '@/components/as-days'
  import EventsList from '@/components/events/as-list'
  import UnsyncedPoster from '@/components/posters/as-svg'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import AsAddress from '@/components/profile/as-address'
  const emit = defineEmits(['active'])
  const props = defineProps({
    pause: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  import { onMounted as mounted } from 'vue'
  import { use as use_sync } from '@/use/sync'
  import { use as use_statements } from '@/use/statements'
  import { use_me, get_my_itemid } from '@/use/people'
  import { directory } from '@/use/serverless'
  const { me } = use_me()

  const { my_statements: my_editable_statements } = use_statements()
  const { events, sync_element: sync, sync_poster } = use_sync()
</script>

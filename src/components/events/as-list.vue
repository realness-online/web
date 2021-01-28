<template>
  <ol itemscope :itemid="itemid" hidden>
    <li v-for="event in events" :key="event.id"
        itemprop="events" itemscope
        :itemid="event.id">
      <link itemprop="url" rel="icon" :href="event.url">
    </li>
  </ol>
</template>
<script>
  export default {
    props: {
      events: {
        type: Array,
        required: true
      },
      itemid: {
        type: String,
        required: true
      }
    }
  }
</script>

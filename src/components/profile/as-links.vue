<template lang="html">
  <div itemscope itemtype="people" style="display:none">
    <link :href="item_id" v-for="person in people">
  </div>
</template>
<script>
  import load_mobile_item from '@/mixins/load_mobile_item'
  export default {
    props: {people: Array},
    mixins: [load_mobile_item]
  }
</script>

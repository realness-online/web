<template lang="html">
  <nav itemscope itemtype="people" style="display:none">
    <link v-for="person in people" :href="get_item_id(person)">
  </nav>
</template>
<script>
  import relationship_status from '@/mixins/relationship_status'
  import load_mobile_item from '@/mixins/load_mobile_item'
  export default {
    props: {people: Array},
    mixins: [relationship_status, load_mobile_item]
  }
</script>

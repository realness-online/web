<template lang="html">
  <div>
    <h1>nothing</h1>
  </div>
</template>

<script>
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import visit from '@/mixins/visit'
  export default {
    mixins: [intersection, vector_click, visit]
  }
</script>

<template lang="html">
  <aside>
    <link v-for="person in people" itemscope :itemid="person.id" :key="person.id">
  </aside>
</template>
<script>
  export default {
    props: { people: Array }
  }
</script>

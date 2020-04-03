<template lang="html">
  <figure>
    <icon name="background"></icon>
    <svg itemscope itemtype="/avatar" :itemid="avatar.id"
         :viewBox="avatar.viewbox" v-html="avatar.path">
    </svg>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
    props: ['avatar']
  }
</script>

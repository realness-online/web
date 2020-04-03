<template lang="html">
  <figure itemscope itemtype="/avatars" :itemid="avatar.id">
    <icon name="background"></icon>
    <svg itemprop="path" preserveAspectRatio="xMidYMin meet"
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

<template lang="html">
  <figure itemscope itemtype="/avatars" :itemid="avatar.id" >
    <figcaption>
      <link itemprop="created_by" rel="author" :href="avatar.created_by">
      <meta itemprop="created_at" :content="avatar.created_at">
      <meta itemprop="view_box" :content="avatar.view_box">
    </figcaption>
    <icon name="background"></icon>
    <svg itemprop="path" preserveAspectRatio="xMidYMin meet"
         :viewBox="avatar.view_box" v-html="avatar.path">
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

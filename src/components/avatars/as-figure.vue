<template lang="html">
  <figure itemscope itemtype="/avatars" :itemid="avatar.id" >
    <figcaption>
      <link itemprop="created_by" rel="author" :href="avatar.created_by">
      <meta itemprop="created_at" :content="avatar.created_at">
      <meta itemprop="view_box" :content="avatar.view_box">
    </figcaption>
    <svg itemprop="path"preserveAspectRatio="xMidYMin meet"
         :viewBox="avatar.view_box" v-html="avatar.path">
    </svg>
  </figure>
</template>
<script>
  export default {
    props: ['avatar']
  }
</script>

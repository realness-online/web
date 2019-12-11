<template lang="html">
  <figure itemscope itemtype="/avatars" :itemid="avatar.id" >
    <svg itemprop="path" @click="menu = !menu" preserveAspectRatio="xMidYMin slice"
         :viewBox="avatar.view_box" v-html="avatar.path">
    </svg>
    <figcaption>
      <meta itemprop="view_box" :content="avatar.view_box">
      <meta itemprop="created_at" :content="avatar.created_at">
    </figcaption>
  </figure>
</template>
<script>
  export default {
    props: ['avatar']
  }
</script>

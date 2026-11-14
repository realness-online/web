<template>
  <li itemscope itemtype="https://schema.org/BlogPosting">
    <router-link :to="`/vault#${posting.itemid}`">
      <span itemprop="headline">{{ posting.title }}</span>
    </router-link>
    <time
      v-if="posting.created"
      :datetime="posting.created"
      itemprop="datePublished">
      {{ posting.created }}
    </time>
    <p v-if="posting.description" itemprop="description">
      {{ posting.description }}
    </p>
  </li>
</template>

<script setup>
  defineProps({
    posting: { type: Object, required: true }
  })
</script>

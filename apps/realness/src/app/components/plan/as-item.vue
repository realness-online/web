<template>
  <li itemscope itemtype="https://schema.org/Article">
    <router-link :to="`/vault#${plan.itemid}`">
      <span itemprop="headline">{{ plan.title }}</span>
    </router-link>
    <pre v-if="plan.diagram" class="mermaid">{{ plan.diagram }}</pre>
    <p>
      <span>{{ plan.area }}</span>
      <span>{{ plan.nodes.open }} open</span>
      <span v-if="plan.nodes.done">{{ plan.nodes.done }} done</span>
      <span v-for="id in plan.nodes.blocked" :key="id">{{ id }} blocked</span>
    </p>
  </li>
</template>

<script setup>
  defineProps({
    plan: { type: Object, required: true }
  })
</script>

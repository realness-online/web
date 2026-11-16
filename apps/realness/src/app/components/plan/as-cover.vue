<template>
  <article
    :data-area="plan.area"
    itemscope
    itemtype="http://schema.org/BlogPosting">
    <figure>
      <figcaption>
        <h3 itemprop="headline">
          <a itemprop="url" :href="`/vault#${plan.itemid}`">{{ plan.title }}</a>
        </h3>
      </figcaption>
      <pre v-if="plan.diagram" class="mermaid">{{ plan.diagram }}</pre>
    </figure>
    <span v-if="plan.area" itemprop="genre">{{ plan.area }}</span>
    <dl aria-label="Nodes">
      <dt>Open</dt>
      <dd>{{ plan.nodes.open }}</dd>
      <template v-if="plan.nodes.done">
        <dt>Done</dt>
        <dd>{{ plan.nodes.done }}</dd>
      </template>
      <template v-for="id in plan.nodes.blocked" :key="id">
        <dt>Blocked</dt>
        <dd>{{ id }}</dd>
      </template>
    </dl>
  </article>
</template>

<script setup>
  defineProps({
    plan: { type: Object, required: true }
  })
</script>

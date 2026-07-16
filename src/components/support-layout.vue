<script setup>
  import SiteNav from '@/components/site-nav'
  import { useRoute as use_route } from 'vue-router'
  const route = use_route()
</script>

<template>
  <site-nav v-if="route.meta.support" />
  <router-view />
</template>

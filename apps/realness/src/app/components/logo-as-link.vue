<script setup>
  import icon from '@/components/icon'

  defineProps({ vault: { type: Boolean, default: false } })
</script>

<template>
  <router-link
    :aria-label="vault ? 'Vault home' : 'Realness home'"
    :to="vault ? '/vault' : '/'"
    tabindex="-1">
    <icon name="realness" />
  </router-link>
</template>

<style>
  svg.realness:active {
    transition-property: transform;
    transition-duration: 0.52s;
    transition-timing-function: var(--ease-click);
    transform: scale(0.95);
  }
</style>

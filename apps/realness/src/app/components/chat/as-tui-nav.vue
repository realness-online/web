<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import { current_user, me } from '@/utils/serverless'
  import { computed } from 'vue'

  const account_label = computed(
    () => (current_user.value && me.value?.name) || 'Account'
  )
</script>

<template>
  <nav aria-label="Terminal">
    <as-chat-toggle />
    <router-link to="/account" aria-keyshortcuts="." title="Open account (.)">{{
      account_label
    }}</router-link>
    <logo-as-link />
  </nav>
</template>

<style lang="stylus">
  nav[aria-label='Terminal'] {
    display: flex;
    align-items: center;
    gap: base-line;
    & > a[href='/account'] {
      margin-inline-start: auto;
      color: var(--accent);
      text-decoration: none;
      &:hover,
      &.router-link-active {
        color: var(--emphasis);
      }
    }
  }
</style>

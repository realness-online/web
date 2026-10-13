<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import { computed } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import { current_user, me } from '@/utils/serverless'

  const route = use_route()
  const pricing_current = computed(() => route?.path?.startsWith('/pricing/'))
  const account_label = computed(
    () => (current_user.value && me.value?.name) || 'Account'
  )
</script>

<template>
  <nav
    itemscope
    itemtype="https://schema.org/SiteNavigationElement"
    aria-label="Site">
    <logo-as-link />
    <menu>
      <router-link to="/about" replace>About</router-link>
      <router-link to="/docs" replace>Docs</router-link>
      <router-link to="/prints" replace>Prints</router-link>
      <router-link
        to="/pricing"
        replace
        :aria-current="pricing_current ? 'page' : undefined"
        >Pricing</router-link
      >
      <router-link to="/terms" replace>Legal</router-link>
      <router-link to="/account" replace>{{ account_label }}</router-link>
    </menu>
    <as-chat-toggle v-if="current_user" />
  </nav>
</template>

<style>
  nav[itemtype$='/SiteNavigationElement'] {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--base-line);
    padding: var(--base-line);
    padding-top: calc(env(safe-area-inset-top, 0px) + var(--base-line));

    menu {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: calc(var(--base-line) * 0.5) var(--base-line);
      list-style: none;

      a {
        color: var(--accent);
        text-decoration: none;

        &:hover {
          color: var(--emphasis);
        }

        &.router-link-active,
        &[aria-current='page'] {
          color: var(--emphasis);
        }
      }

      a[href='/terms'] {
        font-size: smaller;
        opacity: 0.6;

        &:hover,
        &.router-link-active {
          opacity: 1;
        }
      }

      & > a:last-child {
        margin-left: auto;
        text-align: right;
      }
    }
  }
</style>

<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import Icon from '@/components/icon.vue'
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
    <as-chat-toggle v-if="current_user" />
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
      <router-link
        to="/account"
        replace
        :aria-label="account_label"
        :title="account_label">
        <icon name="silhouette" />
      </router-link>
    </menu>
    <logo-as-link />
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

      @media (max-width: 40rem) {
        justify-content: space-between;
        column-gap: calc(var(--base-line) * 0.5);
      }

      & > a:last-child {
        margin-left: auto;
      }

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

      a[href='/account'] {
        display: grid;
        & > svg {
          inline-size: calc(var(--base-line) * 1.1);
          block-size: calc(var(--base-line) * 1.1);
          fill: currentColor;
        }
      }
    }
  }
</style>

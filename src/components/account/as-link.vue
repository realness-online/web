<script setup>
  import { computed } from 'vue'
  import { current_user, me } from '@/utils/serverless'

  defineOptions({ name: 'AccountAsLink' })

  /** Signed-in goes to /account; signed-out goes to sign-on. */
  const target = computed(() => {
    if (!current_user.value) return '/sign-on'
    return '/account'
  })

  const label = computed(() => {
    if (me.value?.name) return me.value.name
    if (current_user.value) return 'account'
    return 'sign on'
  })
</script>

<template>
  <router-link id="toggle-account" :to="target">{{ label }}</router-link>
</template>

<style lang="stylus">
  a#toggle-account {
    & > span {
      margin-left: base-line * .5;
      line-height: 0;
      display: inline-block;
      vertical-align: middle;
    }
  }
</style>

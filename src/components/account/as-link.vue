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

  /** First space splits given name onto two lines; single token stays one line. */
  const name_lines = computed(() => {
    const name = me.value?.name
    if (!name) return null
    const space = name.indexOf(' ')
    if (space === -1) return [name]
    return [name.slice(0, space), name.slice(space + 1)]
  })
</script>

<template>
  <router-link id="toggle-account" :to="target">
    <template v-if="name_lines">
      <span v-for="(line, index) in name_lines" :key="index">{{ line }}</span>
    </template>
    <template v-else>{{ label }}</template>
  </router-link>
</template>

<style lang="stylus">
  a#toggle-account {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.1;
    & > span {
      display: block;
    }
  }
</style>

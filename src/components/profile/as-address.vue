<script setup>
  import { computed } from 'vue'
  import { use_me } from '@/use/people'
  const props = defineProps({
    person: {
      type: Object,
      required: true
    }
  })
  const { me } = use_me()
  const person = computed(() => {
    if (me.value && me.value.id === props.person.id) return me.value
    return props.person
  })
</script>

<template>
  <address itemscope itemtype="/person" :itemid="person.id">
    <header>
      <h3 itemprop="name">{{ person.name }}</h3>
      <slot name="action" />
    </header>
    <slot />
    <link
      v-if="person.avatar"
      :key="person.avatar"
      itemprop="avatar"
      rel="icon"
      :href="person.avatar" />
    <meta v-if="person.visited" itemprop="visited" :content="person.visited" />
  </address>
</template>

<style lang="stylus">
  address[itemscope] {
    color: var(--text);
    & > header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: round((base-line / 3), 2);
      & > button {
        color: var(--emphasis);
        padding-inline: round((base-line / 4), 2);
      }
    }
    & > header > h3,
    & > b {
      text-align: left;
    }
    & > header > h3 {
      font-size: clamp(var(--min-font), fluid-calc(), var(--max-font));
      margin: 0;
      text-transform: capitalize;
    }
    & > b[itemprop] {
      line-height: 1;
      display: inline-block;
      font-weight: 300;
      &:first-of-type {
        margin-right: round((base-line / 6), 2);
      }
      &:focus {
        font-weight: 400;
        outline: 0;
      }
    }
  }
</style>

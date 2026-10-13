<script setup>
  import icon from '@/components/Icon'
  import { load, as_author } from '@/utils/itemid'
  import AsAvatar from '@/components/posters/as-svg'
  import AsAddress from '@/components/profile/as-address'
  import { ref, computed, onMounted as mounted } from 'vue'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  defineOptions({
    name: 'ProfileLink'
  })

  const person = ref(null)

  const author = computed(() => as_author(props.itemid))

  mounted(async () => {
    if (!author.value) return
    person.value = await load(author.value)
  })
</script>

<template>
  <router-link v-if="person" :to="author" data-profile-link>
    <as-avatar v-if="person.avatar" as_avatar :itemid="person.avatar" />
    <icon v-else name="silhouette" />
    <as-address :person="person">
      <slot />
    </as-address>
  </router-link>
</template>

<style>
  a[data-profile-link] {
    display: inline-flex;
    shape-outside: circle();
    margin-right: calc(var(--base-line) / 3);
    & > svg {
      shape-outside: circle();
      fill: var(--moonlight);
      width: calc(var(--base-line) * 2);
      height: calc(var(--base-line) * 2);
      min-height: inherit;
      border-radius: calc(var(--base-line) * 2);
      margin-right: calc(var(--base-line) / 6);
      &.icon {
        fill: var(--accent);
      }
    }
    & > address {
      & > time {
        color: var(--emphasis);
      }
      & > h3 {
        line-height: 1;
        display: inline-block;
      }
    }
  }
</style>

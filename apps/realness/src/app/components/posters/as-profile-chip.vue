<script setup>
  import icon from '@/components/icon'
  import AsAvatar from '@/components/posters/as-avatar'
  import AsFigure from '@/components/profile/as-figure'
  import { useRouter as use_router } from 'vue-router'
  import { computed } from 'vue'
  import { use_me, is_person } from '@/use/people'
  /** @typedef {import('@/types').Id} Id */

  const props = defineProps({
    person: {
      type: Object,
      required: true,
      validator: is_person
    },
    display: {
      type: String,
      default: 'phonebook',
      validator: v => ['label', 'phonebook', 'page'].includes(v)
    },
    poster_itemid: {
      type: String,
      default: undefined
    },
    /** Poster row itemid when embedded from a poster figure (e.g. menu chip); wins over `poster_itemid` when both are set in label mode. */
    itemid: {
      type: String,
      default: undefined
    }
  })
  const { me } = use_me()
  const router = use_router()

  const person = computed(() => {
    if (me.value && me.value.id === props.person.id) return me.value
    return props.person
  })
  const is_me = computed(() => localStorage.me === props.person.id)
  const display_itemid = computed(() => {
    const fallback =
      props.display === 'label'
        ? (props.itemid ?? props.poster_itemid)
        : props.poster_itemid
    return /** @type {Id | undefined} */ (props.person.avatar || fallback)
  })
</script>

<template>
  <router-link
    v-if="display === 'label'"
    :to="person.id"
    :data-display="display">
    <as-avatar v-if="display_itemid" :itemid="display_itemid" />
    <icon v-else name="silhouette" />
    <span>{{ person.name }}</span>
  </router-link>
  <template v-else-if="display === 'page'">
    <as-figure v-if="person.avatar" :person="person" display="page" />
    <icon v-else name="silhouette" />
  </template>
</template>

<style lang="stylus">
  a[data-display='label'] {
    display: flex;
    align-items: center;
    gap: base-line * 0.33;
    color: var(--accent);
    & > svg {
      flex-shrink: 0;
      overflow: hidden;
      width: round(base-line * 2, 2);
      height: round(base-line * 2, 2);
      min-height: 0;
      border-radius: base-line * 0.25;
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>

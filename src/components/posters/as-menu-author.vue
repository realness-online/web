<script setup>
  import icon from '@/components/icon'
  import ToggleAvatar from '@/components/posters/as-button-avatar'
  import { defineAsyncComponent as define_async_component } from 'vue'

  const AsDownload = define_async_component(
    () => import('@/components/download-vector.vue')
  )
  import { is_vector_id } from '@/use/poster'
  import { me } from '@/utils/serverless'
  import { computed } from 'vue'
  defineProps({
    poster: {
      type: Object,
      required: true
    },
    allow_remove: {
      type: Boolean,
      default: true
    }
  })
  const emit = defineEmits({
    remove: is_vector_id,
    avatar: is_vector_id
  })
  const signed_in = computed(() => !!me.value)
</script>

<template>
  <menu>
    <button
      v-if="allow_remove"
      type="button"
      class="remove"
      aria-label="Delete poster"
      @click="emit('remove', poster.id)">
      <icon name="remove" />
    </button>

    <toggle-avatar v-if="signed_in" :itemid="poster.id" />
    <as-download :itemid="poster.id" />
  </menu>
</template>

<style lang="stylus">
  figure.poster > figcaption footer menu menu {
    & > a,
    & > button {
      &.avatar {
        &.selected & > svg {
          fill: red;
        }
      }
      & > svg {
        fill: blue;
      }
    }
    & > button {
      appearance: none;
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: inherit;
      line-height: 1;

      &:focus-visible {
        outline: 0.25px solid currentColor;
        outline-offset: base-line * 0.25;
      }
    }
  }
</style>

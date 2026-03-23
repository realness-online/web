<script setup>
  import icon from '@/components/icon'
  import ToggleAvatar from '@/components/posters/as-button-avatar'
  import EventAsFieldset from '@/components/events/as-fieldset'
  import AsDownload from '@/components/download-vector'
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
    },
    allow_picker: {
      type: Boolean,
      default: true
    }
  })
  const emit = defineEmits({
    remove: is_vector_id,
    picker: is_vector_id,
    avatar: is_vector_id
  })
  const signed_in = computed(() => !!me.value)
</script>

<template>
  <event-as-fieldset
    v-if="allow_picker && poster.picker"
    :itemid="poster.id"
    @picker="emit('picker', poster.id)" />
  <menu v-else>
    <a v-if="allow_remove" class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>

    <toggle-avatar v-if="signed_in" :itemid="poster.id" />
    <as-download :itemid="poster.id" />
  </menu>
</template>

<style lang="stylus">
  figure.poster > figcaption > menu {
    & > a,
    & > button {
      &.avatar {
        standard-shadow: boop;
        &.selected & > svg {
          fill: red;
        }
      }
      &.remove {
        standard-shadow: boop;
      }
      &.save {
        standard-shadow: boop;
      }
      &.event {
        filter: none;
        outline: none;
        border: none;
        background: transparent;
        &:focus {
          outline: none;
        }
        &.selected & > svg {
          fill: red;
        }
      }
      & > svg {
        fill: blue;
      }
    }
    & > button {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: base-line * 0.25;
      padding: base-line * 0.25 base-line * 0.5;
      cursor: pointer;
      color: inherit;
      font-size: larger;
      line-height: 1;
      opacity: 0.7;
      min-width: base-line * 1.5;
      text-align: center;

      &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.5);
      }

      &:focus {
        outline: 0.25px solid currentColor;
        outline-offset: base-line * 0.25;
        opacity: 1;
      }
    }
  }
</style>

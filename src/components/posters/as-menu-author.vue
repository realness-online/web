<script setup>
  import icon from '@/components/icon'
  import ToggleAvatar from '@/components/posters/as-button-avatar'
  import EventAsFieldset from '@/components/events/as-fieldset'
  import EventAsButton from '@/components/events/as-button'
  import AsDownload from '@/components/download-vector'
  import { is_vector_id } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { me } from '@/utils/serverless'
  import { computed } from 'vue'
  const props = defineProps({
    poster: {
      type: Object,
      required: true
    }
  })
  const emit = defineEmits({
    remove: is_vector_id,
    picker: is_vector_id,
    avatar: is_vector_id
  })
  const { register } = use_keymap('Poster_Menu')
  register('poster::Remove', () => emit('remove', props.poster.id))
  register('poster::Make_Avatar', () => emit('avatar', props.poster.id))
  const signed_in = computed(() => !!me.value)
</script>

<template>
  <event-as-fieldset
    v-if="poster.picker"
    :itemid="poster.id"
    @picker="emit('picker', poster.id)" />
  <menu v-else>
    <a class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>

    <toggle-avatar v-if="signed_in" :itemid="poster.id" />
    <as-download :itemid="poster.id" />

    <event-as-button :itemid="poster.id" @picker="emit('picker', poster.id)" />
  </menu>
</template>

<style lang="stylus">
  section#posters > article > figure.poster > figcaption > menu {
    pointer-events: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: base-line * 0.5;
    padding: base-line * 0.5;
    margin: base-line;
    height: auto;
    border-radius: base-line
    background: black-transparent;
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
        fill: green;
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

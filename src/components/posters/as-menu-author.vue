<script setup>
  import icon from '@/components/icon'
  import ToggleAvatar from '@/components/posters/as-button-avatar'
  import EventAsFieldset from '@/components/events/as-fieldset'
  import EventAsButton from '@/components/events/as-button'
  import AsDownload from '@/components/download-vector'
  import { is_vector_id } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { current_user } from '@/utils/serverless'
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
</script>

<template>
  <event-as-fieldset
    v-if="poster.picker"
    :itemid="poster.id"
    @picker="emit('picker', poster.id)" />
  <menu v-else>
    <event-as-button :itemid="poster.id" @picker="emit('picker', poster.id)" />
    <a class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>
    <toggle-avatar v-if="current_user" :itemid="poster.id" />
    <as-download :itemid="poster.id" />
  </menu>
</template>

<style lang="stylus">
  section#posters > article > figure.poster > figcaption > menu > a,
  section#posters > article > figure.poster > figcaption > menu > button {
    standard-shadow: boop;
    &.avatar {
      top: base-line;
      left: calc(50% - 1em);
      &.selected & > svg {
        fill: red;
      }
    }
    &.remove {
      bottom: base-line;
      left: base-line;
    }
    &.save {
      bottom: base-line;
      right: base-line;
    }
    &.event {
      top: base-line;
      left: base-line;
    }
    & > svg {
      fill: green;
    }
  }
</style>

<script setup>
  import icon from '@/components/icon'
  import toggleAvatar from '@/components/posters/as-button-avatar'
  import eventAsFieldset from '@/components/events/as-fieldset'
  import eventAsButton from '@/components/events/as-button'
  import asDownload from '@/components/download-vector'
  import { useRouter as use_router } from 'vue-router'
  import { useActiveElement as use_active_element } from '@vueuse/core'
  import { as_created_at, as_type } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'

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
  const router = use_router()
  const active = use_active_element()

  const edit_poster = itemid =>
    `/${as_type(itemid)}/${as_created_at(itemid)}/editor`
  const open_editor = () =>
    router.replace({ path: edit_poster(props.poster.id) })

  const { register } = use_keymap('Poster_Menu')

  register('poster::Open_Editor', () => {
    // Check if the active element is this poster's element
    if (active.value) {
      const clicked_created_at = active.value.id?.split('-')[2]
      if (clicked_created_at) {
        const clicked = parseInt(clicked_created_at)
        const i_am_created_at = as_created_at(props.poster.id)
        if (clicked === i_am_created_at) open_editor()
      }
    }
  })

  register('poster::Remove', () => {
    emit('remove', props.poster.id)
  })
  register('poster::Make_Avatar', () => {
    emit('avatar', props.poster.id)
  })
</script>

<template>
  <event-as-fieldset
    v-if="poster.picker"
    :itemid="poster.id"
    @picker="emit('picker', poster.id)" />
  <menu v-else>
    <event-as-button :itemid="poster.id" @picker="emit('picker', poster.id)" />
    <router-link class="gear" :to="edit_poster(poster.id)">
      <icon name="gear" />
    </router-link>
    <a class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>
    <toggle-avatar :itemid="poster.id" />
    <as-download :itemid="poster.id" />
  </menu>
</template>

<style lang="stylus">
  section#posters > article > figure.poster
    & > figcaption > menu > a
      standard-shadow: boop
      &.avatar
        top: base-line
        left: calc(50% - 1em)
        &.selected > svg
          fill: red
      &.gear
        top: base-line
        right: base-line
      &.remove
        bottom: base-line
        left: base-line
      &.save
        bottom: base-line
        right: base-line
      &.event
        top: base-line
        left: base-line
      & > svg
        fill: green
</style>

<script setup>
  import Icon from '@/components/icon'
  import AsAvatar from '@/components/posters/as-avatar'
  import PosterAsFigure from '@/components/posters/as-figure'
  import AsAddress from '@/components/profile/as-address'
  import AsMessenger from '@/components/profile/as-messenger'
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
    editable: {
      type: Boolean,
      required: false,
      default: false
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
  const emit = defineEmits(['show'])
  const router = use_router()
  const { me } = use_me()

  const is_me = computed(() => {
    if (localStorage.me === props.person.id) return true
    return false
  })

  const person = computed(() => {
    if (me.value && me.value.id === props.person.id) return me.value
    return props.person
  })

  const avatar_click = () => {
    const route_path = { path: props.person.id }
    router.push(route_path)
  }

  const display_itemid = computed(() => {
    const fallback =
      props.display === 'label'
        ? (props.itemid ?? props.poster_itemid)
        : props.poster_itemid
    return /** @type {Id | undefined} */ (props.person.avatar || fallback)
  })

  const on_poster_hero_show = vector => {
    emit('show', vector)
  }
</script>

<template>
  <router-link v-if="display === 'label'" :to="person.id" class="profile label">
    <as-avatar v-if="display_itemid" :itemid="display_itemid" />
    <icon v-else name="silhouette" />
    <span>{{ person.name }}</span>
  </router-link>
  <div v-else-if="display === 'page' && person.avatar">
    <poster-as-figure
      :itemid="person.avatar"
      :menu="!is_me"
      :menu_always_visible="!is_me"
      pin
      @show="on_poster_hero_show">
      <menu v-if="!is_me">
        <as-messenger :itemid="person.id" />
      </menu>
    </poster-as-figure>
  </div>
  <div v-else-if="display === 'page'">
    <icon name="silhouette" />
  </div>
  <figure v-if="display === 'phonebook'" class="profile">
    <as-avatar
      v-if="person.avatar"
      :itemid="person.avatar"
      :tabable="editable"
      @click="avatar_click" />
    <icon v-else name="silhouette" @click="avatar_click" />
    <figcaption>
      <as-address :key="person.id" :person="person" :editable="editable" />
      <menu>
        <slot v-if="!is_me">
          <as-messenger :itemid="person.id" />
        </slot>
        <slot v-else />
      </menu>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  a.profile.label {
    display: flex;
    align-items: center;
    gap: base-line * 0.33;
    color: var(--accent);
    & > svg {
      flex-shrink: 0;
      overflow: hidden;
      width: round(base-line * 2, 2);
      height: round(base-line * 2, 2);
      border-radius: base-line * 0.25;
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  figure.profile {
    content-visibility: auto;
    contain-intrinsic-size: auto 96px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    justify-content: space-between;
    #background,
    svg.icon.silhouette {
      fill: var(--accent);
    }
    & > svg {
      margin-right: round((base-line * .33), 3);
      min-height: inherit;
      overflow: hidden;
      width: round(base-line * 6, 2);
      height: round(base-line * 6, 2);
      cursor: pointer;
      @media (max-width: pad-begins) {
        border-top-right-radius: 0.66rem;
        border-bottom-right-radius: 0.66rem;
      }
      @media (min-width: pad-begins) {
        border-radius: 0.66rem;
      }
      &.background {
        fill: var(--accent);
      }
    }
    & > figcaption {
      flex: 1;
      display: flex;
      justify-content: space-between;
      & > address,
      & > menu {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      & > address {
        justify-content: center;
      }
      & > menu {
        padding: base-line * .33;
        &:hover {
          opacity: 1;
        }
      }
    }
  }
</style>

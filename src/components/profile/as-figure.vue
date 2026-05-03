<script setup>
  import Icon from '@/components/icon'
  import ProfileAsMeta from '@/components/profile/as-meta'
  import AsRelationshipOptions from '@/components/profile/as-relationship-options'
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import PosterAsFigure from '@/components/posters/as-figure'
  import AsAddress from '@/components/profile/as-address'
  import AsMessenger from '@/components/profile/as-messenger'
  import AsMenuAccount from '@/components/profile/as-menu-account.vue'
  import AsAsideAccount from '@/components/profile/as-aside-account.vue'
  import { useRouter as use_router } from 'vue-router'
  import { computed, ref, provide } from 'vue'
  import { use_me, is_person } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  /** @typedef {import('@/types').Id} Id */
  import { as_layer_id, load_from_cache } from '@/utils/itemid'
  import { geology_layers } from '@/use/poster'
  import { get } from 'idb-keyval'
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
  const { relations, me } = use_me()

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

  const vector = ref(null)
  const shown = ref(false)
  /** Own profile, signed in, no avatar: sheet opened from placeholder control. */
  const placeholder_sheet_open = ref(false)

  const display_itemid = computed(() => {
    const fallback =
      props.display === 'label'
        ? (props.itemid ?? props.poster_itemid)
        : props.poster_itemid
    return /** @type {Id | undefined} */ (props.person.avatar || fallback)
  })

  provide('vector', vector)

  const on_show = shown_vector => {
    if (!shown_vector) return
    vector.value = shown_vector
    if (!vector.value.cutouts && display_itemid.value) {
      vector.value.cutouts = {}
      geology_layers.forEach(layer => {
        const layer_id = as_layer_id(
          /** @type {Id} */ (display_itemid.value),
          layer
        )
        get(layer_id).then(html_string => {
          if (html_string) vector.value.cutouts[layer] = true
        })
        load_from_cache(layer_id).then(({ html }) => {
          if (html) vector.value.cutouts[layer] = true
        })
      })
    }
    shown.value = true
  }

  const on_poster_hero_show = vector => {
    emit('show', vector)
  }

  /** Own profile + signed in: click poster to toggle menu. Others: keep messenger visible. */
  const hero_menu_always_visible = computed(
    () => !is_me.value || !current_user.value
  )

  /** No hero footer when viewing own profile signed out (#account has sign-on). */
  const hero_has_menu = computed(() => !is_me.value || !!current_user.value)
</script>

<template>
  <router-link v-if="display === 'label'" :to="person.id" class="profile label">
    <as-svg
      v-if="display_itemid"
      as_avatar
      :itemid="display_itemid"
      @show="on_show" />
    <icon v-else name="silhouette" />
    <as-poster-symbol
      v-if="display_itemid && shown"
      :itemid="display_itemid"
      :vector="vector"
      :shown="shown" />
    <span>{{ person.name }}</span>
  </router-link>
  <div v-else-if="display === 'page' && person.avatar">
    <poster-as-figure
      :itemid="person.avatar"
      :menu="hero_has_menu"
      :menu_always_visible="hero_menu_always_visible"
      :account-sheet="is_me && !!current_user"
      pin
      @show="on_poster_hero_show">
      <as-menu-account v-if="is_me && current_user" />
      <menu v-else-if="!is_me">
        <as-messenger :itemid="person.id" />
      </menu>
    </poster-as-figure>
  </div>
  <div
    v-else-if="display === 'page' && is_me && current_user && !person.avatar"
    class="profile-hero-no-avatar">
    <button
      type="button"
      class="profile-hero-no-avatar-hit"
      aria-haspopup="dialog"
      :aria-expanded="placeholder_sheet_open"
      @click="placeholder_sheet_open = true">
      <icon name="silhouette" />
      <span>Account</span>
    </button>
    <as-aside-account
      :open="placeholder_sheet_open"
      @close="placeholder_sheet_open = false">
      <as-menu-account />
    </as-aside-account>
  </div>
  <figure v-if="display === 'phonebook' || display === 'page'" class="profile">
    <as-svg
      v-if="person.avatar"
      as_avatar
      :itemid="person.avatar"
      :tabable="editable"
      @show="on_show"
      @click="avatar_click" />
    <icon v-else name="silhouette" @click="avatar_click" />
    <as-poster-symbol
      v-if="person.avatar && shown"
      :itemid="person.avatar"
      :vector="vector"
      :shown="shown" />
    <figcaption>
      <as-address :key="person.id" :person="person" :editable="editable" />
      <menu>
        <slot v-if="!is_me">
          <profile-as-meta :people="relations" />
          <as-relationship-options :person="person" />
          <as-messenger :itemid="person.id" />
        </slot>
        <slot v-else />
      </menu>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  a.profile.label {
    display: flex
    align-items: center
    gap: base-line * 0.33
    color: blue
    & > svg {
      flex-shrink: 0
      width: round(base-line * 2, 2)
      height: round(base-line * 2, 2)
      border-radius: base-line * 0.25
    }
    & > span {
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
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
    #background, svg.icon.silhouette {
      fill: blue;
    }
    & > svg {
      margin-right: round((base-line * .33), 3);
      min-height: inherit;
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
        fill: blue;
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

  .profile-hero-no-avatar {
    display: flex
    flex-direction: column
    align-items: stretch
    min-height: round(base-line * 14, 2)
    margin-bottom: base-line
    border-radius: round((base-line * 0.33), 2)
    overflow: hidden
    background: black-transparent
  }

  .profile-hero-no-avatar-hit {
    flex: 1
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    gap: base-line * 0.5
    min-height: round(base-line * 12, 2)
    padding: base-line
    border: none
    cursor: pointer
    color: blue
    background: transparent
    font: inherit
    -webkit-tap-highlight-color: transparent
    &:focus-visible {
      outline: 0.25px solid red
      outline-offset: base-line * 0.25
    }
    & > svg {
      width: round(base-line * 5, 2)
      height: round(base-line * 5, 2)
      fill: blue
    }
    & > span {
      font-size: 0.9em
      opacity: 0.85
    }
  }
</style>

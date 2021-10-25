<template>
  <figure class="profile">
    <as-svg :person="person" @vector-click="avatar_click" />
    <figcaption>
      <as-address
        :key="person.id"
        :person="person"
        :editable="editable"
        @update:person="$emit('update:person', $event)" />
      <menu>
        <slot v-if="!is_me">
          <profile-as-meta :people="relations" />
          <as-relationship-options
            :person="person"
            :relations="relations"
            @remove="remove_relationship"
            @add="add_relationship" />
          <as-messenger :itemid="person.id" />
        </slot>
        <slot v-else />
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import { Relations } from '@/persistance/Storage'
  import profile_as_meta from '@/components/profile/as-meta'
  import as_relationship_options from '@/components/profile/as-relationship-options'
  import as_svg from '@/components/avatars/as-svg'
  import as_address from '@/components/profile/as-address'
  import as_messenger from '@/components/profile/as-messenger'
  export default {
    components: {
      'as-svg': as_svg,
      'as-address': as_address,
      'profile-as-meta': profile_as_meta,
      'as-relationship-options': as_relationship_options,
      'as-messenger': as_messenger
    },
    props: {
      person: {
        type: Object,
        required: true
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      },
      relations: {
        type: Array,
        required: false,
        default: () => []
      }
    },
    emits: ['update:person', 'update:relations'],
    data() {
      return {
        saving: false
      }
    },
    computed: {
      is_me() {
        if (localStorage.me === this.person.id) return true
        else return false
      }
    },
    methods: {
      avatar_click() {
        const route = { path: this.person.id }
        if (this.is_me) route.path = '/account'
        this.$router.push(route)
      },
      async add_relationship(person) {
        const relations = this.relations
        relations.push(person)
        await this.$nextTick()
        new Relations().save()
        this.$emit('update:relations', relations)
      },
      async remove_relationship(person) {
        const relations = this.relations
        const index = relations.findIndex(p => p.id === person.id)
        if (index > -1) {
          relations.splice(index, 1)
          await this.$nextTick()
          new Relations().save()
          if (!relations.length) localStorage.removeItem(`${localStorage.me}/relations`)
          this.$emit('update:relations', relations)
        }
      }
    }
  }
</script>
<style lang="stylus">
  figure.profile
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    display:flex
    justify-content: space-between
    #background
      fill: blue
    & > svg
      margin-right: round((base-line / 3), 3)
      width: round(base-line * 6, 2)
      height: round(base-line * 6, 2)
      cursor: pointer
      @media (max-width: pad-begins)
        border-top-right-radius: 0.66rem
        border-bottom-right-radius: 0.66rem
      @media (min-width: pad-begins)
        border-radius: 0.66rem
      &.background
        fill: blue
    & > figcaption
      flex: 1
      display: flex
      justify-content: space-between
      & > address
      & > menu
        display: flex
        flex-direction: column
        justify-content: space-between
      & > address
        justify-content: center
      & > menu
        padding: base-line
        &:hover
          opacity: 1
        & > a > svg
          fill: blue
</style>

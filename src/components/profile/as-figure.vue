<template>
  <figure class="profile">
    <as-svg :person="person" @vector-click="avatar_click" />
    <figcaption>
      <as-hgroup :key="person.id" :person="person" :editable="editable" />
      <menu>
        <slot>
          <profile-as-links :people="relations" />
          <as-relationship-options :person="person"
                                   :relations="relations"
                                   @remove="remove_relationship"
                                   @add="add_relationship" />
        </slot>
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import { Relations } from '@/persistance/Storage'
  import profile_as_links from '@/components/profile/as-links'
  import as_relationship_options from '@/components/profile/as-relationship-options'
  import as_svg from '@/components/avatars/as-svg'
  import as_hgroup from '@/components/profile/as-hgroup'
  export default {
    components: {
      'as-svg': as_svg,
      'as-hgroup': as_hgroup,
      'profile-as-links': profile_as_links,
      'as-relationship-options': as_relationship_options
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
    data () {
      return {
        saving: false
      }
    },
    computed: {
      is_me () {
        if (localStorage.me === this.person.id) return true
        else return false
      }
    },
    methods: {
      avatar_click (event) {
        const route = { path: this.person.id }
        if (this.is_me) route.path = '/account'
        this.$router.push(route)
      },
      async add_relationship (person) {
        const relations = this.relations
        relations.push(person)
        await this.$nextTick()
        new Relations().save()
        this.$emit('update:relations', relations)
      },
      async remove_relationship (person) {
        const relations = this.relations
        const index = relations.findIndex(p => (p.id === person.id))
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
      width: 4rem
      height: 4rem
      cursor: pointer
      @media (max-width: pad-begins)
        border-top-right-radius: 0.66rem
        border-bottom-right-radius: 0.66rem
      border: 1px solid blue
      @media (min-width: pad-begins)
        border-radius: 0.66rem
      &.background
        fill: blue
    & > figcaption
      flex: 1
      display: flex
      & > hgroup
        padding: (base-line / 3)
        flex: 1
      & > menu
        padding-right: (base-line / 2)
        padding-left: (base-line / 3)
        padding-top: (base-line / 2)
        opacity: 0.66
        &:hover
          opacity: 1
</style>

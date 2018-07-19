<template lang="html">
  <nav class="profile-index">
    <li v-for="person in people">
      <profile-as-figure :person="person"></profile-as-figure>
      <menu>
        <a v-if='person.is_relation'><icon :name="following"></icon></a>
        <a v-if='!person.is_relation'><icon :name="follow"></icon></a>
      </menu>
    </li>
  </nav>
</template>
<script>
  import as_figure from '@/components/profile/as-figure'
  import icon from '@/components/icon'
  export default {
    props: ['people'],
    components: {
      'profile-as-figure': as_figure,
      icon
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  nav.profile-index
    & > li
      margin-top: base-line
      list-style: none
      display: flex
      justify-content: space-between
      & > figure
        & > figcaption a
          color:blue
        & svg
          fill:blue
      & > menu
        display: inline-flex
        align-items: center;
        margin-left:  (base-line / 2)
        svg
          cursor: pointer;
          fill:blue
          width: (base-line * 2)
          height: (base-line * 2)
          &:active
            width: (base-line * 1.66)
            height: (base-line * 1.66)
    @media (min-width: min-screen)
      display: flex
      flex-direction: row
      flex-wrap: wrap
      justify-content: space-between
      & > li
        padding: (base-line / 2)
        standard-border: blue
        border-radius: (base-line / 3)
        width:49%
    @media (min-width: max-screen)
      & > li
        width:32%
</style>

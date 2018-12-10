<template lang="html">
  <nav class="profile-list">
    <li v-for="person in people_as_item">
      <as-figure :person="person"></as-figure>
      <as-relationship-options :person="person"></as-relationship-options>
    </li>
  </nav>
</template>
<script>
  import as_figure from '@/components/profile/as-figure'
  import as_options from '@/components/profile/as-relationship-options'
  import phone_number from '@/modules/phone_number'
  export default {
    components: {
      'as-figure': as_figure,
      'as-relationship-options': as_options
    },
    watch: {
      people() {
        console.log('watch')
        this.people.forEach(phone => {
          // console.log(phone.id)
          phone_number.profile(phone.id).then(item => {
            console.log(item)
            this.people_as_item.push(item)
          })
        })
      }
    },
    props: {
      people: {
        type: Array
      }
    },
    data() {
      return {
        people_as_item: []
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  nav.profile-list
    & > li
      margin-top: base-line
      list-style: none
      display: flex
      justify-content: space-between
      & > figure
        & > figcaption a
          color:blue
        & svg
          fill: blue
          stroke: lighten(blue, 33%)
    @media (min-width: min-screen)
      display: flex
      flex-direction: row
      flex-wrap: wrap
      justify-content: space-between
      & > li
        padding: (base-line / 2)
        standard-border: blue
        width:49%
    @media (min-width: max-screen)
      & > li
        width:32%
</style>

<template>
  <section id="relations" class="page">
    <header>
      <router-link v-if="signed_in" to="/phone-book">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Relations</h1>
    </hgroup>
    <profile-as-list v-if="signed_in" :people="relations" />
    <hgroup v-else class="sign-on message">
      <p>
        <sign-on /> and you can check out <icon name="heart" /> who's on here
      </p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import sign_on from '@/components/profile/sign-on'
  export default {
    components: {
      icon,
      'sign-on': sign_on,
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link
    },
    mixins: [signed_in],
    data () {
      return {
        signed_in: true,
        relations: []
      }
    },
    async created () {
      console.info('Views relations')
      this.relations = await itemid.list(`${this.me}/relations`)
      this.relations.forEach(async (relation, index) => {
        const person = await itemid.load(relation.id)
        this.relations.splice(index, 1, person)
      })
    }
  }
</script>
<style lang='stylus'>
  section#relations
    svg
      &.heart
        fill: blue
      &.working
        margin-bottom: base-line
    & > header
      margin: auto
</style>

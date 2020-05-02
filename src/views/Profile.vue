’<template lang="html">
  <section id="profile" class="page" ref='profile'>
    <header>
      <icon name='nothing'></icon>
      <logo-as-link></logo-as-link>
    </header>
    <avatar @loaded="avatar_loaded" :person="person"></avatar>
    <menu v-if="avatar">
      <download-vector :vector="avatar"></download-vector>
    </menu>
    <profile-as-figure :person='person'></profile-as-figure>
    <as-days :posters="posters" :statements="statements">
      <poster-as-figure v-if="item.type === 'posters'" :poster="item"></poster-as-figure>
      <thought-as-article v-else :item="item" @viewed="statement_viewed"></thought-as-article>
    </as-days>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import profile from '@/helpers/profile'
  import itemid from '@/helpers/itemid'
  import as_thoughts from '@/helpers/thoughts'
  import icon from '@/components/icon'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import download_vector from '@/components/download-vector'
  import profile_as_figure from '@/components/profile/as-figure'
  import avatar from '@/components/avatars/as-svg'
  import as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/feed/as-figure'
  export default {
    mixins: [ signed_in ],
    components: {
      avatar, icon,
      'profile-as-figure': profile_as_figure,
      'download-vector': download_vector,
      'logo-as-link': logo_as_link,
      'poster-as-figure': poster_as_figure,
      'thought-as-article': as_article
    },
    data () {
      return {
        person: {},
        statements: [],
        posters: [],
        working: true,
        avatar: null
      }
    },
    async created () {
      const id = profile.from_e64(this.$route.params.phone_number)
      const [person, statements, posters] = await Promise.all([
        itemid.load(id),
        itemid.list(`${id}/statements`),
        itemid.directory(`${id}/posters`)
      ])
      this.person = person
      this.statements = as_thoughts(statements)
      this.posters = posters
      console.info(`Views ${person.first_name}'s profile`)
    },
    methods: {
      avatar_loaded (avatar) {
        this.avatar = avatar
      }
    }
  }
</script>
<style lang='stylus'>
  section#profile
    & > header
      z-index: 2
      position: absolute
      width:100%
      & > a
        -webkit-tap-highlight-color: blue
    & > svg:not(.working)
      width: 100vw
      min-height: 100vh
    & > menu
      display: flex
      justify-content: flex-end
      padding: base-line
      margin-top -(base-line * 4 )
      & > a
        text-align: right
        & > svg
          fill: red
    & > figure
    & > div
      max-width: page-width
      margin: auto
      padding: base-line base-line 0 base-line
    & > div
      display:flex
      flex-direction: column
      & > section.day
        display:flex
        flex-direction: column
        &.today
          flex-direction: column-reverse
          & > header
            order: 1
        & > header > h4
          margin-top: base-line
        & > div > figure
          margin-bottom: base-line
          & > figcaption
            span, a
              display:none
            time
              margin-bottom: base-line
</style>

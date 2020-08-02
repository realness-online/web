<template lang="html">
  <section id="profile" ref="profile" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <avatar :person="person" @loaded="avatar_loaded" />
    <menu v-if="avatar">
      <download-vector :vector="avatar" />
    </menu>
    <profile-as-figure :person="person" />
    <as-days v-slot="items" :posters="posters" :statements="statements">
      <div v-for="item in items" :key="slot_key(item)">
        <poster-as-figure v-if="item.type === 'posters'"
                          :itemid="item.id"
                          :verbose="true" />
        <thought-as-article v-else
                            :statements="item"
                            :verbose="true"
                            @show="thought_shown" />
      </div>
    </as-days>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import profile from '@/helpers/profile'
  import { load, list, as_directory } from '@/helpers/itemid'
  import icon from '@/components/icon'
  import as_days from '@/components/as-days'
  import logo_as_link from '@/components/logo-as-link'
  import download_vector from '@/components/download-vector'
  import profile_as_figure from '@/components/profile/as-figure'
  import avatar from '@/components/avatars/as-svg'
  import as_article from '@/components/statements/as-article'
  import poster_as_figure from '@/components/posters/as-figure'
  export default {
    components: {
      avatar,
      icon,
      'as-days': as_days,
      'profile-as-figure': profile_as_figure,
      'download-vector': download_vector,
      'logo-as-link': logo_as_link,
      'poster-as-figure': poster_as_figure,
      'thought-as-article': as_article
    },
    mixins: [signed_in],
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
        load(id),
        list(`${id}/statements`),
        as_directory(`${id}/posters`)
      ])
      if (person) this.person = person
      else return
      if (statements) this.statements = statements
      if (posters) {
        posters.items.forEach(created_at => {
          this.posters.push({
            id: `${id}/posters/${created_at}`,
            type: 'posters'
          })
        })
      }
      console.info(`Views ${person.first_name}'s profile`)
    },
    methods: {
      slot_key (item) {
        let slot_key = null
        if (Array.isArray(item) && item.length) slot_key = item[0].id
        if (item.id) slot_key = item.id
        return slot_key
      },
      avatar_loaded (avatar) {
        this.avatar = avatar
      },
      thought_shown (statement) {
        console.log('thought_shown', statement)
      }
    }
  }
</script>
<style lang='stylus'>
  section#profile
    padding-bottom: base-line
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

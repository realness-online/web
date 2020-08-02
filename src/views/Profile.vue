<template lang="html">
  <section id="profile" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <avatar v-if="person" :person="person" />
    <menu v-if="person">
      <download-vector :itemid="person.avatar" />
    </menu>
    <profile-as-figure v-if="person" :person="person" />
    <as-days v-slot="items" :posters="posters" :statements="statements">
      <div v-for="item in items" :key="slot_key(item)">
        <poster-as-figure v-if="item.type === 'posters'"
                          :itemid="item.id" />
        <thought-as-article v-else
                            :statements="item"
                            @show="thought_shown" />
      </div>
    </as-days>
  </section>
</template>
<script>
  import signed_in from '@/mixins/signed_in'
  import profile from '@/helpers/profile'
  import { newest_number_first } from '@/helpers/sorting'
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
        working: true,
        person: null,
        statements: [],
        pages_viewed: ['index'],
        posters: []
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
        if (Array.isArray(item)) return item[0].id
        return item.id
      },
      async thought_shown (thought) {
        const id = profile.from_e64(this.$route.params.phone_number)
        const thought_oldest = thought[thought.length - 1]
        const oldest = this.statements[this.statements.length - 1]
        if (oldest.id === thought_oldest.id) {
          const directory = await as_directory(`${id}/statements`)
          let history = directory.items
          history.sort(newest_number_first)
          history = history.filter(page => !this.pages_viewed.some(viewed => viewed === page))
          const next = history.shift()
          if (next) {
            const next_statements = await list(`${id}/statements/${next}`)
            this.pages_viewed.push(next)
            this.statements = [...this.statements, ...next_statements]
          }
        }
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
    svg.background
      fill: blue
    figure.profile
      padding: base-line
    section.as-days
      padding: base-line
      padding-top: 0
      article.day
        @media (min-width: pad-begins)
          grid-auto-rows: auto
        @media (min-width: typing-begins)
          grid-auto-rows: auto
</style>

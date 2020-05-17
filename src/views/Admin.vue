<template lang="html">
  <section id="admin" class="page">
    <header>
      <icon name="nothing"></icon>
      <h1>Admin</h1>
      <logo-as-link></logo-as-link>
    </header>
    <as-days v-for="person in phonebook"
            :key="person.id"
            :statements="person.statements" v-slot="thoughts">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought"
                          :verbose="false">
      </thought-as-article>
    </as-days>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import itemid from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'as-days': as_days,
      'thought-as-article': thought_as_article
    },
    data () {
      return {
        phonebook: []
      }
    },
    async created () {
      console.time('admin-load')
      console.info('Views Admin')
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      await phone_numbers.prefixes.forEach(async (phone_number, index) => {
        const person = await itemid.load(profile.from_e64(phone_number.name))
        if (person.id) {
          const statements = await itemid.load(`${person.id}/statements`)
          if (Array.isArray(statements.statements)) person.statements = statements.statements
          else person.statements = [statements.statements]
          this.phonebook.push(person)
        }
      })
      console.timeEnd('admin-load')
    }
  }
</script>
<style lang="stylus">
  section#admin
    padding: base-line

    article.day
      grid-auto-rows: inherit

</style>

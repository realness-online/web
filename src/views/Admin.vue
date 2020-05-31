<template lang="html">
  <section id="admin" class="page">
    <header>
      <icon name="nothing" />
      <h1>Admin</h1>
      <logo-as-link />
    </header>
    <details>
      <summary>
        <h4>Statements</h4>
      </summary>
      <button @click="save_statements">Save</button>
      <as-days v-for="person in phonebook" :key="person.id"
               v-slot="thoughts" :statements="person.statements"
               itemscope :itemid="itemid(person)">
        <thought-as-article v-for="thought in thoughts"
                            :key="thought[0].id"
                            :statements="thought"
                            :verbose="false" />
      </as-days>
    </details>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import { load, list } from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  import { Admin } from '@/persistance/Storage'
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
        const person = await load(profile.from_e64(phone_number.name))
        console.log(person)
        const statements = await list(`${person.id}/statements`)
        if (Array.isArray(statements)) person.statements = statements
        else person.statements = [statements]
        this.phonebook.push(person)
      })
      console.timeEnd('admin-load')
    },
    methods: {
      save_statements () {
        this.phonebook.forEach(person => {
          console.log(`saving ${person.first_name}`)
          const saver = new Admin(`${person.id}/statements`)
          console.log(saver.id)
          const statements = document.querySelector(`[itemid="${saver.id}"]`)
          console.log(statements)
          saver.to_network(statements.outerHTML)
        })
      },
      itemid (person) {
        return `${person.id}/statements`
      }
    }
  }
</script>
<style lang="stylus">
  section#admin
    padding: base-line
    article.day
      grid-auto-rows: inherit
</style>

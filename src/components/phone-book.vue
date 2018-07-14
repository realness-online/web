<template>
  <section id="phonebook" class="page">
    <header >
      <h1>Phone book</h1>
    </header>
    <profile-as-list :people='phonebook'></profile-as-list>
  </section>
</template>
<script>
  import Vue from 'vue'
  import profile_as_list from '@/components/profile/as-list'
  import Storage, {phonebook} from '@/modules/Storage'

  export default {
    components: {
      'profile-as-list': profile_as_list
    },
    data() {
      return {
        phonebook: [],
        phonebook_storage: phonebook
      }
    },
    created: function() {
      this.$bus.$on(['signed-in', 'person-saved'], (person) => {
        this.phonebook_storage.update(person)
          .then(people => this.phonebook = people)
      })
    },
    watch: {
      phonebook() {
        Vue.nextTick(() => {
          this.phonebook_storage.save()
        })
      }
    }
  }
</script>

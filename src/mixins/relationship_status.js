import Vue from 'vue'
import {relations_storage} from '@/modules/Storage'
import phone_number from '@/modules/phone_number'
export default {
  watch: {
    relations() {
      this.relations_as_item = []
      console.log('relations watch', this.relations.length)

      Vue.nextTick(() => relations_storage.save())
    }
  },
  data() {
    return {
      relations: relations_storage.as_list(),
      relations_as_item: []
    }
  },
  created() {
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
    relations_storage.as_list().forEach(item => {
      phone_number.profile(item.id).then(person => {
        this.relations_as_item.push(person)
      })
    })
    this.$bus.$on('add-relationship', person => {
      console.log('add-relationship', person)
      this.relations.push(person)
      this.relations_as_item = []
      this.relations.forEach(item => {
        phone_number.profile(item.id).then(person => {
          this.relations_as_item.push(person)
        })
      })
      localStorage.setItem('relations-count', this.relations.length)
    })
    this.$bus.$on('remove-relationship', person => {
      console.log('remove-relationship', person)
      const index = this.relations.findIndex(p => (p.id === person.id))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
      }
    })
  }
}

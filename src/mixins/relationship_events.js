import { relations_storage } from '@/modules/Storage'
import Vue from 'vue'
export default {
  data() {
    return {
      working: true,
      relations: relations_storage.as_list()
    }
  },
  created() {
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
    this.$bus.$on('add-relationship', person => {
      this.relations.push(person)
      localStorage.setItem('relations-count', this.relations.length)
      Vue.nextTick(() => relations_storage.save())
    })
    this.$bus.$on('remove-relationship', person => {
      const index = this.relations.findIndex(p => (p.id === person.id))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
        Vue.nextTick(() => relations_storage.save())
      }
    })
  }
}

import {relations_storage} from '@/modules/Storage'
import Vue from 'vue'
export default {
  data() {
    return {
      working: true,
      relations: relations_storage.as_list()
    }
  },
  created() {
    console.log('relationship_events')
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
    this.$bus.$on('add-relationship', person => {
      console.log('add-relationship', person)
      this.relations.push(person)
      localStorage.setItem('relations-count', this.relations.length)
      Vue.nextTick(() => relations_storage.save())
    })
    this.$bus.$on('remove-relationship', person => {
      console.log('remove-relationship', person)
      const index = this.relations.findIndex(p => (p.id === person.id))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
        Vue.nextTick(() => relations_storage.save())
      }
    })
  }
}

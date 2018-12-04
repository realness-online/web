import Vue from 'vue'
import {relations_storage} from '@/modules/Storage'
export default {
  watch: {
    relations() {
      Vue.nextTick(() => relations_storage.save())
    }
  },
  data() {
    return {
      relations: relations_storage.as_list()
    }
  },
  created() {
    localStorage.setItem('relations-count', this.relations.length)
    this.$bus.$on('add-relationship', person => {
      this.relations.push(person)
      localStorage.setItem('relations-count', this.relations.length)
    })
    this.$bus.$on('remove-relationship', (person) => {
      const index = this.relations.findIndex(p => (p.mobile === person.mobile))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
      }
    })
  },
  beforeDestroy() {
    console.log('destroy a plate')
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
  }
}

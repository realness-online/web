import { relations_local } from '@/modules/Storage'
import Vue from 'vue'
export default {
  data() {
    return {
      working: true,
      relations: relations_local.as_list()
    }
  },
  created() {
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
    this.$bus.$on('add-relationship', this.add_relationship)
    this.$bus.$on('remove-relationship', this.remove_relationship)
  },
  methods: {
    add_relationship(person) {
      this.relations.push(person)
      localStorage.setItem('relations-count', this.relations.length)
      Vue.nextTick(_ => relations_local.save())
    },
    remove_relationship(person) {
      const index = this.relations.findIndex(p => (p.id === person.id))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
        Vue.nextTick(_ => relations_local.save())
      }
    }
  }
}

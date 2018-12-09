import Vue from 'vue'
import {relations_storage} from '@/modules/Storage'
import phone_number from '@/modules/phone_number'
export default {
  watch: {
    relations() {
      Vue.nextTick(() => relations_storage.save())
    }
  },
  data() {
    return {
      relations: []
    }
  },
  created() {
    this.$bus.$on('add-relationship', person => {
      this.relations.push(person)
      localStorage.setItem('relations-count', this.relations.length)
    })
    this.$bus.$on('remove-relationship', person => {
      const index = this.relations.findIndex(p => (p.mobile === person.mobile))
      if (index > -1) {
        this.relations.splice(index, 1)
        localStorage.setItem('relations-count', this.relations.length)
      }
    })
    relations_storage.as_list().forEach(item => {
      console.log('item', item)
      phone_number.profile(item.item_id).then(items => {
        this.relations.push(items[0])
      })
    })
  },
  beforeDestroy() {
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
  }
}

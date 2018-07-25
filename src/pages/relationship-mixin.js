import Vue from 'vue'
import {relations_storage} from '@/modules/Storage'
import logo_as_link from '@/components/logo-as-link'
import icon from '@/components/icon'
import profile_as_list from '@/components/profile/as-list'
var relationship_mixin = {
  components: {
    'logo-as-link': logo_as_link,
    'profile-as-list': profile_as_list,
    icon
  },
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
    console.log('created')
    this.$bus.$off('remove-relationship')
    this.$bus.$off('add-relationship')
    localStorage.setItem('relations-count', this.relations.length)
    this.$bus.$on('add-relationship', person => this.relations.push(person))
    this.$bus.$on('remove-relationship', (person) => {
      const index = this.relations.findIndex(p => (p.mobile === person.mobile))
      if (index > -1) {
        this.relations.splice(index, 1)
      }
    })
  }
}
export default relationship_mixin

import { relations_local } from '@/modules/LocalStorage'
export default {
  data() {
    return {
      relations: relations_local.as_list()
    }
  },
  methods: {
    async add_relationship(person) {
      this.relations.push(person)
      await this.$nextTick()
      relations_local.save()
    },
    async remove_relationship(person) {
      const index = this.relations.findIndex(p => (p.id === person.id))
      if (index > -1) {
        this.relations.splice(index, 1)
        await this.$nextTick()
        relations_local.save()
      }
    }
  }
}

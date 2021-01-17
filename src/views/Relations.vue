<template>
  <section id="relations" class="page">
    <header>
      <icon name="nothing" />
      <router-link to="/phone-book">
        <icon name="finished" />
      </router-link>
    </header>
    <hgroup>
      <h1>Relations</h1>
    </hgroup>
    <nav v-if="signed_in" class="profile-list">
      <as-figure v-for="person in relations" :key="person.id" :person="person" :relations.sync="relations" />
    </nav>
  </section>
</template>
<script>
  import { list, load } from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import as_figure from '@/components/profile/as-figure'
  export default {
    components: {
      icon,
      'as-figure': as_figure
    },
    mixins: [signed_in],
    data () {
      return {
        signed_in: true,
        relations: []
      }
    },
    async created () {
      console.clear()
      console.info('views:relations')
      const temp = await list(`${localStorage.me}/relations`)
      temp.forEach(async (relation, index) => {
        const person = await load(relation.id)
        this.relations.splice(index, 1, person)
      })
    }
  }
</script>
<style lang='stylus'>
  section#relations
    & > header
      margin: auto
      svg
        &.finished
          fill: blue
        &.working
          margin-bottom: base-line
</style>

<template lang="html">
  <div v-for="[page_name, days] in pages" :key="page_name">
    <section class="day" v-for="[date, day] in days" :key="date" v-bind:class="{today: is_today(date)}">
      <header><h4>{{as_day(date)}}</h4></header>
      <div v-for="post in day" :key="post.id">
        <poster-as-figure v-if="post.type === 'posters'"
                          :poster="post">
        </poster-as-figure>
        <post-as-article v-else
                         :post="post"
                         :person="post.person"
                         @end-of-articles="next_page">
        </post-as-article>
      </div>
    </section>
</template>
<script>
  import post_as_article from '@/components/feed/as-article'
  import poster_as_figure from '@/components/feed/as-figure'
  export default {
    components: {
      'post-as-article': post_as_article,
      'poster-as-figure': poster_as_figure
    },
    methods: {
      async get_first_posts(people_in_feed) {
        let feed = []
        await Promise.all(people_in_feed.map(async (relation) => {
          const [person, posts, posters] = await Promise.all([
            profile.load(relation.id),
            profile.items(relation.id, 'posts/index'),
            profile.directory(relation.id, 'posters')
          ])
          this.relations.push(person)
          feed = [...this.condense_posts(posts, person),
                  ...this.prepare_posters(posters, person), ...feed]
        }))
        feed.sort(this.newer_first)
        feed.forEach(post => this.insert_post_into_day(post, this.days))
      },
      async next_page(person) {
        if (person.page) person.page = growth.next(person.page)
        else person.page = growth.first()
        console.log(`posts.${person.page}`, person.first_name)
        let posts = await profile.items(person.id, `posts/${person.page}`)
        posts = this.condense_posts(posts, person)
        posts.forEach(post => this.insert_post_into_day(post, this.days))
        const sorted = [...this.days.entries()].sort(this.newer_day_first)
        this.days = new Map(sorted)
      }
    }
  }
</script>
<style lang="stylus">
</style>

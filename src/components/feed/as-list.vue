<template>
  <div itemprop="feed" itemref="profile">
    <article v-for="post in feed" itemscope itemtype="/post">
      <header>
        <profile-as-figure :person='post.person'></profile-as-figure>
      </header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
    </article>
  </div>
</template>
<script>
  export default {
    props: {
      posts: Array
    }
  }
</script>

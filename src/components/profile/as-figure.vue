<template id="profile-as-figure">
  <figure itemref="profile">
    <profile-as-uid></profile-as-uid>
    <a itemprop="slug" :href="profile.slug">
      <img itemprop="avatar" :src="profile.avatar">
      <figcaption itemprop="display_name">{{profile.display_name}}</figcaption>
    </a>
  </figure>
</template>

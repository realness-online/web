<template lang="html">
  <p itemprop="statement" :data-who="statement.who" :data-why="statement.why" :data-created_at="statement.created_at" :data-where="statement.where">
    {{statement.what}}
  </p>
</template>

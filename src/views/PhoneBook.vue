<script setup>
  import icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsFigure from '@/components/profile/as-figure'

  import { watch } from 'vue'
  import { current_user } from '@/utils/serverless'
  import { use as use_people } from '@/use/people'
  console.time('views:PhoneBook')
  const { phonebook, load_phonebook, working } = use_people()

  watch(
    () => current_user.value,
    async () => {
      await load_phonebook()
      console.timeEnd('views:PhoneBook')
    },
    { immediate: true }
  )
</script>

<template>
  <section id="directory" class="page">
    <header>
      <logo-as-link />
      <router-link v-if="current_user" to="/relations">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
    </header>
    <h1>Phonebook</h1>
    <icon v-if="working" name="working" />
    <nav class="profile-list">
      <as-figure
        v-for="person in phonebook"
        :key="person.id"
        :person="person" />
    </nav>
  </section>
</template>

<style lang="stylus">
  section#directory
    padding-bottom: base-line * 2
    & > header > a > svg.heart
      fill: blue
    & > svg.working
      margin-top: base-line
      @media (prefers-color-scheme: dark)
        fill: blue
    & > h1
      margin-top: 0
      margin-bottom: base-line * 2
      text-align: center
      color: blue
    & > nav.profile-list
      margin-top: base-line
      figure.profile
        svg.working
          fill: blue
      & address > h3
        max-width: base-line * 6
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
</style>

<template>
  <section id="directory" class="page">
    <header>
      <router-link v-if="current_user" to="/relations">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
      <logo-as-link />
    </header>
    <h1>Phonebook</h1>
    <icon v-if="working" name="working" />
    <nav v-if="current_user" class="profile-list">
      <as-figure
        v-for="person in phonebook"
        :key="person.id"
        :person="person" />
    </nav>
    <footer v-if="!working && !current_user">
      <sign-on v-if="!current_user" />
    </footer>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsFigure from '@/components/profile/as-figure'
  import SignOn from '@/components/profile/sign-on'

  import { watch, onMounted as mounted } from 'vue'
  import { current_user } from '@/use/serverless'
  import { use as use_people } from '@/use/people'

  const { phonebook, load_phonebook, working } = use_people()

  watch(current_user, async () => {
    await load_phonebook()
  })
  mounted(async () => {
    await load_phonebook()
    console.info('views:Phonebook')
  })
</script>
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
      & address > h3
        max-width: base-line * 6
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
    & > footer
      display: flex
      flex-direction: column
      justify-content: space-evenly
      align-items: center
      & > p
        margin-top: base-line
</style>

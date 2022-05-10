<template>
  <section id="directory" class="page">
    <header>
      <router-link v-if="current_user" to="/relations">
        <icon name="heart" />
      </router-link>
      <icon v-else name="nothing" />
      <h1>PhoneBook</h1>
      <logo-as-link />
    </header>
    <icon v-if="working" name="working" />
    <nav v-if="current_user" class="profile-list">
      <as-figure
        v-for="person in phonebook"
        :key="person.id"
        v-model:relations="relations"
        :person="person" />
    </nav>
    <footer v-if="!working && !current_user">
      <p class="sign-on message">Coming in July</p>
    </footer>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  import AsFigure from '@/components/profile/as-figure'
  import SignOn from '@/components/profile/sign-on'

  import { ref, onMounted as mounted } from 'vue'
  import { current_user } from '@/use/serverless'
  import { use } from '@/use/people'
  const { phonebook, relations, load_phonebook, load_relations } = use()
  const working = ref(true)

  mounted(async () => {
    await load_phonebook()
    await load_relations({ id: localStorage.me })
    console.info('views:PhoneBook')
    working.value = false
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

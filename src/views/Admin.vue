<template lang="html">
  <section id="admin" class="page">
    <header>
      <icon name="nothing" />
      <h1>Admin</h1>
      <logo-as-link />
    </header>
    <details>
      <summary>
        <h4>Statements</h4>
      </summary>
      <button @click="save_statements">Save</button>
      <as-days v-for="person in phonebook" :key="person.id"
               v-slot="thoughts" :statements="person.statements"
               itemscope :itemid="itemid(person)">
        <thought-as-article v-for="thought in thoughts"
                            :key="thought[0].id"
                            :statements="thought"
                            :verbose="false" />
      </as-days>
    </details>
    <details>
      <summary>
        <h4>Typography sample</h4>
      </summary>
      <p>
        Angel Adept Blind Bodice Clique Coast Dunce Docile Enact Eosin Furlong
        Focal Gnome Gondola Human Hoist Inlet Iodine Justin Jocose Knoll Koala
        Linden Loads Milliner Modal Number Nodule Onset Oddball Pneumo Poncho
        Quanta Qophs Rhone Roman Snout Sodium Tundra Tocsin Uncle Udder Vulcan
        Vocal Whale Woman Xmas Xenon Yunnan Young Zloty Zodiac. Angel angel
        adept for the nuance loads of the arena cocoa and quaalude. Blind blind
        bodice for the submit oboe of the club snob and abbot. Clique clique
        coast for the pouch loco of the franc assoc and accede. Dunce dunce
        docile for the loudness mastodon of the loud statehood and huddle.
        Enact enact eosin for the quench coed of the pique canoe and bleep.
        Furlong furlong focal for the genuflect profound of the motif aloof
        and offers. Gnome gnome gondola for the impugn logos of the unplug
        analog and smuggle. Human human hoist for the buddhist alcohol of the
        riyadh caliph and bathhouse. Inlet inlet iodine for the quince champion
        of the ennui scampi and shiite. Justin justin jocose for the djibouti
        sojourn of the oranj raj and hajjis. Knoll knoll koala for the banknote
        lookout of the dybbuk outlook and trekked. Linden linden loads for the
        ulna monolog of the consul menthol and shallot. Milliner milliner
        modal for the alumna solomon of the album custom and summon. Number
        number nodule for the unmade economic of the shotgun bison and tunnel.
        Onset onset oddball for the abandon podium of the antiquo tempo and
        moonlit. Pneumo pneumo poncho for the dauphin opossum of the holdup
        bishop and supplies. Quanta quanta qophs for the inquest sheqel of the
        cinq coq and suqqu. Rhone rhone roman for the burnt porous of the lemur
        clamor and carrot. Snout snout sodium for the ensnare bosom of the genus
        pathos and missing. Tundra tundra tocsin for the nutmeg isotope of the
        peasant ingot and ottoman. Uncle uncle udder for the dunes cloud of the
        hindu thou and continuum. Vulcan vulcan vocal for the alluvial ovoid of
        the yugoslav chekhov and revved. Whale whale woman for the meanwhile
        blowout of the forepaw meadow and glowworm. Xmas xmas xenon for the
        bauxite doxology of the tableaux equinox and exxon. Yunnan yunnan young
        for the dynamo coyote of the obloquy employ and sayyid. Zloty zloty
        zodiac for the gizmo ozone of the franz laissez and buzzing.
      </p>
    </details>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/storage'
  import { load, list } from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  import { Admin } from '@/persistance/Storage'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  export default {
    components: {
      icon,
      'logo-as-link': logo_as_link,
      'as-days': as_days,
      'thought-as-article': thought_as_article
    },
    data () {
      return {
        phonebook: []
      }
    },
    async created () {
      console.time('admin-load')
      console.info('Views Admin')
      const phone_numbers = await firebase.storage().ref().child('/people/').listAll()
      await phone_numbers.prefixes.forEach(async (phone_number, index) => {
        const person = await load(profile.from_e64(phone_number.name))
        console.log(person)
        person.statements = await list(`${person.id}/statements`)
        this.phonebook.push(person)
      })
      console.timeEnd('admin-load')
    },
    methods: {
      save_statements () {
        this.phonebook.forEach(person => {
          console.log(`saving ${person.first_name}`)
          const saver = new Admin(`${person.id}/statements`)
          console.log(saver.id)
          const statements = document.querySelector(`[itemid="${saver.id}"]`)
          console.log(statements)
          saver.to_network(statements.outerHTML)
        })
      },
      itemid (person) {
        return `${person.id}/statements`
      }
    }
  }
</script>
<style lang="stylus">
  section#admin
    padding: base-line
    article.day
      grid-auto-rows: inherit
</style>

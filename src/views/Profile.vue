<script setup>
  import AsDays from '@/components/as-days'
  import LogoAsLink from '@/components/logo-as-link'
  import AsFigure from '@/components/profile/as-figure'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'
  import Icon from '@/components/icon'

  import { use as use_statements } from '@/use/statements'
  import { use_posters } from '@/use/poster'
  import { use_feed } from '@/use/feed'
  import { use as use_person, from_e64 } from '@/use/people'
  import { provide, computed, watch, inject } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import { as_type, feed_slot_itemid } from '@/utils/itemid'
  import { menu } from '@/utils/preference'

  const route = use_route()
  const person_id = computed(() =>
    from_e64(String(route.params.phone_number ?? ''))
  )

  const { load_person, person, people } = use_person()

  const {
    statements,
    statement_shown,
    for_person: statements_for_person,
    update_statement
  } = use_statements()
  provide('update_statement', update_statement)
  const {
    posters,
    for_person: posters_for_person,
    poster_shown
  } = use_posters()
  const feed_needs_refresh = inject('feed_needs_refresh', null)
  const {
    load_feed_for_people,
    is_editable,
    overlay_for_day,
    overlay_statements_for_poster,
    overlay_editable_for_poster
  } = use_feed({
    posters,
    statements,
    statements_for_person,
    posters_for_person,
    refresh_signal: feed_needs_refresh
  })

  const load_profile_feed = async id => {
    people.value = []
    await load_person({ id })
    await load_feed_for_people([id], { reset: true })
  }
  watch(person_id, id => load_profile_feed(id), { immediate: true })

  const should_show_thought = (day, item) =>
    overlay_for_day(day).merged_thought_keys.has(feed_slot_itemid(item)) ===
    false
</script>

<template>
  <section id="profile" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <as-figure
      v-if="person"
      display="page"
      :person="person"
      @show="poster_shown" />
    <as-days v-slot="{ day }" :posters="posters" :statements="statements">
      <template v-for="item in day" :key="feed_slot_itemid(item)">
        <poster-as-figure
          v-if="
            item.type === 'posters' ||
            as_type(feed_slot_itemid(item)) === 'posters'
          "
          :itemid="feed_slot_itemid(item)"
          :menu="menu"
          :overlay_statements="overlay_statements_for_poster(day, item)"
          :overlay_editable="overlay_editable_for_poster(day, item)"
          @show="poster_shown" />
        <thought-as-article
          v-else-if="should_show_thought(day, item)"
          :statements="item"
          :editable="is_editable(item)"
          @show="statement_shown" />
      </template>
    </as-days>
  </section>
</template>

<style lang="stylus">
  section#profile {
    padding: 0;
    & > header {
      height: 0;
      padding: 0;
      & > a {
        -webkit-tap-highlight-color: var(--accent);
        z-index: 2;
        top: safe_inset(top);
        left: base-line;
        position: absolute;
      }
    }
    & > header + div {
      position: relative;
      overflow: hidden;
      max-height: 100dvh;
      & > svg.icon.silhouette {
        width: 100%;
        height: 100dvh;
        fill: currentColor;
      }
      & > figure.poster {
        content-visibility: visible;
        width: 100%;
        min-height: 100dvh;
        max-height: 100dvh;
        grid-row-start: auto;
        border-radius: 0;
        contain-intrinsic-size: auto 100dvh;
        & > svg[itemscope] {
          width: 100dvw;
          min-height: 100dvh;
          max-height: 100dvh;
        }
        & > figcaption {
          & > footer > menu {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: base-line * 0.5;
            z-index: 1;
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 0 base-line;
            box-sizing: border-box;
            animation: absolute-slide-up;
            animation-delay: 1.33s;
            animation-duration: 0.35s;
            animation-fill-mode: both;
            & > a,
            & > nav,
            & > button,
            & > a > svg {
              fill: var(--accent);
            }
          }
        }
      }
    }
    & > figure.profile {
      padding: base-line;
      & > svg {
        border-radius: 0.66em;
        width: base-line * 2;
        height: base-line * 2;
        border-radius: base-line;
      }
      & > figcaption > menu {
        display: none;
        a.status {
          position: absolute;
          top: base-line;
          left: base-line;
          animation: absolute-slide-down;
          animation-delay: 1.33s;
          animation-duration: 0.35s;
          animation-fill-mode: both;
          svg.add {
            width: base-line * 2;
            height: base-line * 2;
          }
          &.relation {
            svg.add {
              width: 0;
              height: 0;
            }
            svg.finished {
              width: base-line * 2;
              height: base-line * 2;
            }
          }
        }
        a.phone {
          display: none;
        }
      }
    }
    & > section.as-days {
      padding-left: 0;
      padding-right: 0;
      & [role='feed'] > article > header {
        padding-left: base-line;
        padding-right: base-line;
      }
      & article.thought {
        padding-left: base-line;
        padding-right: base-line;
      }
      & [role='feed'] > article {
        @media (prefers-color-scheme: dark) {
          & > header > h4,
          figure.poster > svg.background {
            color: var(--accent);
          }
        }
        figure.poster {
          border-radius: 0;
          & > figcaption > menu {
            & > a.download svg {
              fill: var(--accent);
            }
            & > a.phone {
              display: none;
            }
            & > a.profile,
            & > address {
              & > time {
                font-size: max-font;
                color: var(--accent);
              }
              & > h3 {
                display: none;
              }
            }
            & > svg {
              display: none;
            }
          }
        }
      }
    }
  }
</style>

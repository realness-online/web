# Realness - Architecture

![Realness](/public/icons.svg)

Realness is a progressive web app. It is serverless and static, and the heavy
lifting happens at the edge, on the device. You moderate an instance of Realness
via the [firebase console](https://firebase.google.com).

## Where data lives

Size decides the store. Items under 21KB go to `localStorage`: preferences,
viewbox coordinates, friend groups, and events. Larger items go to IndexedDB
through `idb-keyval`: posters, thoughts, and information about the people you
follow. The thresholds are MIN 21KB, MID 34KB, MAX 55KB.

Both stores are on the device, so the app works offline, and view states,
preferences, and data survive a page reload. Vector tracing, animation, and
every interaction run locally.

## Data structure

Each person has their own directory of HTML files, and that directory is their
activity. A `Profile` lives at the root of it and has many `Thoughts`, `Events`,
and `Posters`.

## Stack

Vue.js and workers, with Firebase Auth and Storage behind them. Design is
applied with Stylus via CSS queries.

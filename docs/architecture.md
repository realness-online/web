# Realness – Architecture

![Realness](/public/icons.svg)

Realness is a progressive web app. It is serverless and static. All of the heavy lifting is done at the edge on device. You moderate an instance of Realness via the [firebase console](https://firebase.google.com)

## Client-Only, Offline-First Design

**Full functionality without tracking** - Realness works solely on the client, giving users complete control over their data and experience.

### Storage Strategy

- **Small items** (< 21KB) → `localStorage` (preferences, viewbox coordinates, friend groups, events)
- **Large items** (> 21KB) → `idb-keyval` (IndexedDB) (posters, thoughts, user data)
- **Size thresholds**: MIN=21KB, MID=34KB, MAX=55KB
- **No server dependency** - Everything works offline
- **Persistent state** - View states, preferences, and data survive page reloads

### Privacy & Control

- **No analytics** - No tracking, no monitoring, no data collection
- **Client-side processing** - All vector graphics, animations, and interactions happen locally
- **User-owned data** - Data you create is stored on your device
- **No backend coordination** - Build complete applications without the backend having to keep up

## Birds Eye View

We use Vue.js, workers, Firebase Auth & Storage primarily. Design is applied with Stylus via CSS queries. Data you create is stored in localStorage. Large files and information about the people you follow is stored with indexdb.

## Highlights

- It's best practices
- It's fast
- It's cheap to run
- The data it makes is yours
- **Full functionality offline**
- **No tracking or analytics**

### Data structure

Each user has their own directory of html files that is their activity. A `Profile` lives at the root of this directory and has many `Thoughts`, `Events`, and `Posters`

```

```

# Realness – Architecture

![Realness](/public/icons.svg)

Realness is a progressive web app. It is serverless and static. All of the heavy lifting is done at the edge on device. You moderate an instance of Realness via the [firebase console](https://firebase.google.com)

## Birds Eye View

We use Vue.js, workers, Firebase Auth & Storage primarily. Design is applied with Stylus via CSS queries. Data you create is stored in localStorage. Large files and information about the people you follow is stored with indexdb.

## Highlights

- It's best practices
- It's fast
- It's cheap to run
- The data it makes is yours

### Data structure

Each user has their own directory of html files that is their activity. A `Profile` lives at the root of this directory and has many `Statements`, `Events`, and `Posters`

```
index.html
statements/index.html
events/index.html
posters/${created-at}.html
```

Relationships are exclusive to the device, so a person's feed is constructed there. The app makes heavy use of HTTP2 streams, able to pull hundreds of files into the client as one query.

# Code Map

All of the root files are for building realness. `workers.config` builds the workers, `vue.config` is build instructions for the web application.

Running `yarn deploy` will fully exercise the application creating reports on code coverage, linting, and reporting on what files are being created and their sizes.

## `public/`

Contains static files that get merged into the `dist` directory with the built files.

The `@/App` is loaded by `@/main.js` from `public/index.html` and is organized `App > views > components`

### `@/views`

Each view of the application is represented here.

### `@/components`

At the root are global components. Each folder represents components for persisted data. Generally, they are named for the html structure they represent. `@/components/profile/as-figure` as an example.

### `@/persistance`

All `Storage` objects can be `Local`, saved in the `Cloud`. They can be `Large` or `Paged` across documents.

### `@/modules`

`Item` parses [HTML](https://www.w3.org/TR/microdata/) into JavaScript objects.

### `@/use/itemid`

a utility method for getting information based on [itemId](https://www.w3.org/TR/microdata/). This is my favorite class. It's where CSS, JavaScript and HTML play each of their parts perfectly.

The other utility methods are standard.

### `@/style`

As the html is persisted – it is critical that no markup is added to assist design. This has forced a reliance on structure and the heavy use of CSS queries to style the application.

`Typography` is the UI foundation for realness. It orchestrates the visual language. Structured HTML naturally aligns and is consistently rendered because of all the work that was done here.

`icons.svg` contains all of the graphics. The realness logo is rendered by default allowing it to serve as the applications favicon.

### `@/workers`

All thread-blocking activity is isolated into workers built via `workers.config.js`.

`vector` converts a jpg into a vector graphic. `optimize` will then optimize the vector (often by 10x). `service` is about caching all built resources on the client. and `sync` handles checking for and removing stale information about you and your relationships

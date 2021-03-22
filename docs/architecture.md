

# Realness – Architecture

![Realness](../src/style/icons.svg)

Most of the application is a static Progressive web app.  All of the heavy lifting is done at the edge on device. The server handles authorization and storage.

## Birds Eye View

We use Vue.js, workers, Firebase Auth & Storage, Stylus, and a ton CSS queries. Data is stored to localStorage with large files and relationship data stored to indexdb.

## Goals
- It's best practices
- It's fast
- It's cheap to run
- The data it makes is yours

### Data structure

Each user has their own directory of html files that is their activity. A `Profile` has an `Avatar`, many `Statements`, many `Relationships`, many `Events`, and many `Posters`

```
index.html
statements/index.html
events/index.html
avatars/${created-at}.html
posters/${created-at}.html
```

Relationships are exclusive to the device. a person's feed is created on the client. The app makes heavy use of HTTP2 streams, able to pull hundreds of files into the client as one query.

# Code Map
All of the root files are for building realness. `workers.config` builds the workers, `vue.config` is build instructions for the web application.

running `yarn deploy` will fully exersize the application giving you reports on code coverage, linting, and reporting on what files are being created and their sizes.

## `public/`
Contains static files that get merged into the `dist` directory with the built files.

## `src/` = `@`

`src` is the application that gets built. Inside javascript is represented by `@`. Overall, most of the application is in `@/components`, `@/modules/Item` reads From HTML,  `@/persistance/Storage` saves the state of the HTML, which means the `@/style` has to be query driven.

The `@/App` is loaded by `@/main.js` from `public/index.html`

### `@/persistance`

All `Storage` objects can be `Local`, saved in the `Cloud`.
They can be `Large` or `Paged` across documents.

###`@/modules`

`Item` parses [HTML](https://www.w3.org/TR/microdata/) into JavaScript objects.


### `@/helpers`

`itemid` is utility method for getting information based on [itemId]((https://www.w3.org/TR/microdata/)). This is my favorite class. It's where CSS, JavaScript and HTML play each of their parts perfectly.

The other utility methods are standard.

### `@/compoonents`
Most of the application is componentst



### `@/style`
As the html is persisted it is critical that no markup is added to assist rendering. This has force the heavy use of CSS queries to style the application.

#### `elements` contains the baseline look and feel for the application.

`Typography` is the UI foundation for realness. It orchestrates the visual language. Structured HTML  naturally aligns and is consistently rendered because of all the work that was done here.

`icons` contains all of the graphics. The realness logo is rendered by default allowing it to serve as the applications favicon.

### `package.json`

`yarn deploy` runs linting and tests that global code coverages requirements are met. Artifacts are created that you can use to see exactly what lines of code are being covered by tests.

## Development setup

I normally have three tabs on terminal running

- `yarn serve` runs the client code
- `yarn workers:dev` runs my workers which do the heavy lifting
- `yarn test --watch --coverage --verbose` gives me visibility

Which will give me coverage for the files I've edited. I can see all files with ever test run if I switch to `--watchAll`

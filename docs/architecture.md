
![realness online](../src/icons.svg)

# Realness – Architecture

The server is as static as possible leaving all of the heavy lifting to be done at the edge on the device. The application is a serverless, progressive web app with performance on par with native applicaions. 

## Birds Eye View

We make heavy use of Vue.js, Firebase Auth and Storage, and Stylus for the user experience. Data is stored first to localStorage with large files and relationship data living in indexdb. The server is a directory of html files based on phone numbers. 

- It's production ready
- It's fast to use
- It's cheap to run
- The data it makes is yours

### Data structure
```
/people/${phone-number}/index.html 
											 /avatars/${created-at}.html
										 	 /posters/${created-at}.html
											 /statements/index.html
	 										 /events/index.html
```

## Code Map

### `src/persistance`
The object model is a `Profile` an `Avatar`, many `Statements`, many `Relationships`, many `Events`, and many `Posters`

Realness doesn't store relationship information on the server, so a person's feed is created on the client. [Feed.js](https://github.com/scott-fryxell/realness/blob/master/src/views/Feed.vue) makes heavy use of HTTP2 streams. I am able to pull potentially hundreds of files into the client as one query. It's an interesting algorithm that loads up to date profile and statement information from a simple list of phone numbers. Feed is performant  (sorting the feed by date is currently averaging 5 milliseconds) and has plenty of headroom for optimization as the user base grows.


`src/modules`

`Item` parses HTML into javascript objects Via [microdata](https://www.w3.org/TR/microdata/).

`Item` to populate VUE objects in the UI and `persistance/Storage` to save them to localStorage. Item.js and Storage.js together are my answer to flux and Vuex. Javascript functions as a controller preserving MVC pattern. All Models are described in HTML. State is defined as the rendered document and so is clear safely abstracted away.

Defining my object model has allowed me to take utilize document and DOM to give meliable state managment without the overhead  vuex/redux like functionality

and yet via it's access to a declaritive framework (html with microdata) provides me with a rich enviroment to describe my objects fully down to being able to make type desisions based on attributes.

### `src/style'

`Typography.styl` is the UI foundation for realness. It sets up a baseline look and feel that allows me to add UI elements and trust they will align in a consistent and natural way. Text is readable and flows well: there is heavy use of a [mixin](https://github.com/scott-fryxell/realness/blob/master/src/style/mixins/between.styl) I wrote that uses the slope-intercept form to scale UI elements to the display size (font size, line length, form inputs, images, menus etc).

## Why
A [lessons learned](http://facebook.com) re-imagining of how we can build web apps that benifit all participants

A critical goal for the applicaytion is to slowly transition moderators into confident software engineers.

The application is intended to be a best proactices, production ready, living example of the power of edge computing.

Realness is cheap to run and fast to use. It has been designed to run first in the browser; there is extensive caching and the app works without a network connection.

The goal is to support  one hundred active daily users without triggering firebase billing.

- It's real
- It's fast
- It's cheap
- It's yours

# Deploy

Deploying an instance of realness
Currently test coverage is at 90%. Deploying the application runs linting and testing with failures if code coverage drops. It's desigend to be a developemnt daily driver.

The application is architected around the interplay between HTML, CSS, javascript,

### [HTML]() a declarative language
HTML is a declarative language and It's combined with a basic file system is how information is used internally and stored on the server.

The application types are defined with the microdata format which makes them easy to query with CSS.

`Item` is the interface between the html and javascipt objects Realness needs to control the flow of information.

This use of HTML has forced me to write the minimal amoubnt of html possible. as the html is the database. This Has the advantage of making the HTML pretty easy to understand.

Matching files to functionality is natural and understanding a complex datasctructure is possible without an overwhelming preamble.

Javascript has almost no awareness of the object model. It's focus is to orchestrate the interplay between the different pieces of data through [Vue](https://vuejs.org) components.

<script setup>
  import Icon from '@/components/icon'
  import LogoAsLink from '@/components/logo-as-link'
  console.info('views:documentation')
</script>

<template>
  <section id="documentation" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <h1>Documentation</h1>
    <article>
      <header>
        <h3>
          Drawing and Vector Graphics
          <router-link to="/about">Workflows</router-link>
        </h3>
      </header>
      <p>
        Realness is fast. It works best on a phone when you save it to your home
        screen. No matter the device, you get a fun experience.
      </p>
      <p>
        Realness supports vector workflows. Take a picture, and Realness will
        create a super fun rotoscope vector graphic. Each photo has eighteen
        gradients for you to pull color from. Realness integrates right into
        Figma, Affinity, Procreate, or Adobe toolchains.
      </p>

      <h5>Name</h5>

      <p>
        Fill out your name; nice. If you choose to sign in, you will show up in
        the phonebook. People can message you directly. Realness it's blind to
        search engines and has no tracking or advertising.
      </p>

      <h5>Sync</h5>

      <p>
        You can sync Realness across all your devices. Take a picture on your
        phone and then open realness on your ipad and send it to Procreate (via
        affinity designer).
      </p>

      <p>Realness updates at eight-hour intervals.</p>

      <p>
        Settings can be changed via the gear icon at the bottom of the screen
      </p>

      <p>
        SVG's work great for most design tools. If you want to use your poster
        in Procreate You'll need to convert it to PSD with Affinity Designer or
        Adobe Illustrator
      </p>

      <h5>Philosophy</h5>

      <p>
        Realness tries to be as small as possible so that you can trust the affection it generates.
        The server knows your phone number and the content you create. Your relationships remain on device.
        Images that you upload to create Posters and Avatars are converted on device and then discarded.
      </p>

      <p>
        Realness believes moderators should be at the center of social networking. Moderators keep it human.
        Everyone can become a moderator. We believe realness is a natural form of social networking that
        supports the fundamental needs of citizens in a democracy.
      </p>

      <h5>What You Can Do</h5>

      <ul>
        <li>Post statements that become trains of thought as you add to them</li>
        <li>Develop your pictures into vector graphics that you use as posters</li>
        <li>Download the posters that you create</li>
        <li>Sign up with your phone number and create an avatar</li>
        <li>Look for people you may know on Realness</li>
        <li>Add those people and view their feed</li>
        <li>View a list of upcoming events</li>
        <li>Contact a Moderator you probably know in real life</li>
      </ul>

      <p>
        There are no likes, no friend counts, no comments. And the application is not playing
        engagement games with your mind. You text when your friends post something that moves you.
      </p>

      <h5>Architecture</h5>

      <p>
        Realness is a progressive web app that is serverless and static. All of the heavy lifting
        is done at the edge on device. You moderate an instance of Realness via the Firebase console.
      </p>

      <h6>Client-Only, Offline-First Design</h6>

      <p>
        <strong>Full functionality without tracking</strong> - Realness works solely on the client,
        giving users complete control over their data and experience.
      </p>

      <h6>Storage Strategy</h6>

      <ul>
        <li><strong>Small items</strong> (&lt; 21KB) → localStorage (preferences, viewbox coordinates, friend groups, events)</li>
        <li><strong>Large items</strong> (&gt; 21KB) → IndexedDB (posters, statements, user data)</li>
        <li><strong>No server dependency</strong> - Everything works offline</li>
        <li><strong>Persistent state</strong> - View states, preferences, and data survive page reloads</li>
      </ul>

      <h6>Privacy & Control</h6>

      <ul>
        <li><strong>No analytics</strong> - No tracking, no monitoring, no data collection</li>
        <li><strong>Client-side processing</strong> - All vector graphics, animations, and interactions happen locally</li>
        <li><strong>User-owned data</strong> - Data you create is stored on your device</li>
        <li><strong>No backend coordination</strong> - Build complete applications without the backend having to keep up</li>
      </ul>

      <h5>JSDoc Configuration</h5>

      <p>
        Realness uses JSDoc for type safety and documentation. The configuration
        includes:
      </p>

      <ul>
        <li><strong>Source:</strong> Processes all .js and .vue files in the src directory</li>
        <li><strong>Exclusions:</strong> Skips files starting with underscore</li>
        <li><strong>Plugins:</strong> Uses markdown plugin for enhanced documentation</li>
        <li><strong>Output:</strong> Generates docs to ./docs/generated directory</li>
        <li><strong>Templates:</strong> Enables clever links and monospace formatting</li>
        <li><strong>Tags:</strong> Supports both JSDoc and Closure tag dictionaries</li>
      </ul>

      <p>
        Documentation is automatically generated and includes type information
        from JSDoc comments throughout the codebase.
      </p>

      <h5>Contributing</h5>

      <p>
        The best way to start is deploy your own instance of realness and then read about the
        philosophy and architecture. Deploying creates an `artifacts` folder with reports on what files are generated.
      </p>

      <h6>Development Setup</h6>

      <p>A standard setup is usually three tabs in a terminal running the following scripts:</p>

      <ul>
        <li><code>npm run dev</code> runs the client code on <code>http://localhost:8080</code></li>
        <li><code>npm run dev:workers</code> keeps the workers current</li>
        <li><code>npm test</code> runs tests with code coverage</li>
      </ul>

      <p>
        For a fully functioning localhost save a file named <code>.env.local</code> to the root of your project
        with your firebase keys. Check out env.example for exact names.
      </p>

      <h6>Pull Request Guidelines</h6>

      <ul>
        <li>Work in the <code>src</code> folder and <strong>DO NOT</strong> checkin <code>dist</code> or <code>artifacts</code></li>
        <li>Make sure <code>yarn test --coverage</code> passes</li>
        <li>Add accompanying test cases for new features</li>
        <li>Provide detailed descriptions for bug fixes</li>
      </ul>
    </article>
  </section>
</template>

<style lang="stylus">
  section#documentation > article {
    max-width: page-width;
    margin: 0 auto;
  }
</style>

<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Vault docs">
    <header aria-label="Vault docs">
      <nav aria-label="Related">
        <router-link to="/vault">Vault</router-link>
        <router-link to="/vault/about">About</router-link>
      </nav>
      <h1>Vault docs</h1>
      <p>Start at the vault. Open a note from a link or from search.</p>
    </header>
    <section>
      <h2>Find a note</h2>
      <p>
        Open <router-link to="/vault">the vault</router-link> for plans and
        pages. A link with <code>#itemid</code> opens that note.
      </p>
    </section>
    <section>
      <h2>Commands</h2>
      <p>
        <router-link to="/vault/commands">Commands</router-link> lists every
        command you can run, grouped by task.
      </p>
    </section>
    <section>
      <h2>Tools</h2>
      <p>
        <router-link to="/vault/tools">Tools</router-link> lists the tool pages
        in the vault.
      </p>
    </section>
    <section>
      <h2>Maps</h2>
      <p>
        <router-link to="/vault/maps/modules">Modules</router-link> and
        <router-link to="/vault/maps/ways-in">Ways in</router-link> show how the
        system fits together.
      </p>
    </section>
    <section>
      <h2>Keys</h2>
      <p>
        <router-link to="/vault/keys">Keys</router-link> shows the key layouts
        for this machine.
      </p>
    </section>
    <section>
      <h2>Write</h2>
      <p>
        Write notes in markdown. Write machine state as HTML pages, one article
        per item, with an itemid on the root.
      </p>
    </section>
  </article>
</template>

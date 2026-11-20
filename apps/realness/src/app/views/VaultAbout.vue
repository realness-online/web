<template>
  <article
    itemscope
    itemtype="https://schema.org/WebPage"
    aria-label="About the vault">
    <header aria-label="About the vault">
      <nav aria-label="Related">
        <router-link to="/vault">Vault</router-link>
        <router-link to="/vault/docs">Docs</router-link>
      </nav>
      <h1>Vault</h1>
      <p>
        Your catalog and the system's state. Notes, plans, pages, and posters
        live here.
      </p>
    </header>
    <section>
      <h2>One address per item</h2>
      <p>
        Every file carries an itemid: a frontmatter line in a note, the root
        attribute in HTML or SVG. A move or rename keeps the identity, so links
        keep working.
      </p>
    </section>
    <section>
      <h2>Two kinds of writing</h2>
      <dl>
        <dt>Notes</dt>
        <dd>Plans, profiles, and prose in markdown.</dd>
        <dt>Pages</dt>
        <dd>
          Machine state in HTML with Schema.org microdata, one item per article.
        </dd>
      </dl>
    </section>
    <section>
      <h2>Who sees what</h2>
      <p>
        Access follows the people and organizations that hold the note. Sign in
        to see the parts that are yours.
      </p>
    </section>
  </article>
</template>

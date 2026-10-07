<template>
  <header>
    <router-link to="/"><h1>Notes</h1></router-link>
  </header>
  <main>
    <router-view />
  </main>
</template>

<style>
  body {
    font: 1.125rem/1.5 system-ui, sans-serif;
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem;
  }
  header a {
    color: inherit;
    text-decoration: none;
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  input,
  textarea {
    font: inherit;
    padding: 0.5rem;
  }
  textarea {
    min-height: 12rem;
  }
  menu {
    display: flex;
    gap: 0.75rem;
    padding: 0;
  }
  button {
    font: inherit;
  }
  ol {
    padding: 0;
    list-style: none;
  }
  ol article {
    padding: 0.75rem 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  }
  ol h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  ol p {
    margin: 0.25rem 0 0;
    opacity: 0.7;
  }
</style>

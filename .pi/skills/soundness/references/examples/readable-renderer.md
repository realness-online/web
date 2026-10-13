# Readable renderer

Source: the Brayness renderer review in this session, applied to
`apps/realness/tools/examples/static` and `apps/realness/tools/publish`.

## Architecture

Before: a build script embedded CSS and browser code, rewrote another build
script, and generated a second copy of the same source.

After: one renderer owns the assets and an explicit plans mode. Builders pass
settings rather than modifying code. Templates, Markdown, images, output,
and watching have separate responsibilities.

Keep entry points small. Split responsibilities, not arbitrary line counts.

## Functions and comments

Use `const` arrow functions, exported ones included. No `function` keyword.
Returned APIs use named object-literal methods; standalone utilities stay
separate.

```js
// instead of: export function create_pages(site, ...) {
export const create_pages = (site, ...) => {
  // instead of: function article_slug(file) {
  const article_slug = (file) => {
    // Strip a leading content/articles/<year>/ folder from the URL slug.
  }
}
```

Minimize inline comments. A non-obvious rule moves into short JSDoc on the
function or shape it explains; a comment that restates the code is deleted.

## Returned APIs

Avoid separate declarations followed by a repeated export list:

```js
async function build_article(file) {
  // Render the file.
}
return { build_article };
```

Define the named method where the API is returned:

```js
return {
  /** @param {string} file */
  async build_article(file) {
    // Render the file.
  },
};
```

Keep independent exported utilities as standalone functions. Do not add
`this` dependencies to methods used as callbacks.

## Output boundaries

A template must escape metadata and labels, while retaining the distinction
between plain text and deliberately supplied HTML:

```js
return `<article>
  <h1>${escape_html(title)}</h1>
  <section>${rendered_body}</section>
</article>`;
```

Escaping metadata does not make arbitrary article HTML safe. Document who
owns the rendered body, and test quotes and markup in text fields.

## Package and platform

Declare Mermaid in package.json and copy its installed browser bundle.
Remove the separate CDN fetch, checksum, and cache.

Use package.json imports for `#root/` in Node. Keep browser imports resolvable
without assuming that browsers read Node package settings.

## Verification

- Compare identical content through both build paths.
- Check routes, selected assets, omitted drafts, and publication privacy.
- Check covers, keyboard interaction, navigation, and CSS limits in a browser.
- Prove regression tests fail when the fix is removed.

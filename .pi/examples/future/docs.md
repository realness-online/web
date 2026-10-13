# Future example: documentation

For a person who wants the product's own docs in one file, readable as a page
or as raw markdown.

## What

- One markdown file is the source; the page renders it.
- The same file is served raw at `/documentation.md` for agents.
- A table of contents from the headings, with an anchor per section.
- A dialog mode, so the terminal and chat pages open docs without leaving.
- Search jumps between headings; no full-text index.

## Done when

A page and `/documentation.md` show the same file, a heading link opens the
right section, and the dialog opens over the terminal and chat.

## Open questions

- One file for the whole product, or a folder with a page each?
- Does the dialog live in the host page or in the example itself?

## What it needs from Brayness

- A markdown source the terminal and chat pages can fetch same-origin.
- Heading anchors stable enough to link from an error message.

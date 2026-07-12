# potrace port

This directory is a JavaScript port of [potrace](http://potrace.sourceforge.net/)
by Peter Selinger, derived from [node-potrace](https://github.com/tooolbox/node-potrace)
by mattmc. Both upstream projects are GPL-2.0, and this port remains GPL-2.0.

Realness adapted the port to ES modules, runs it in a dedicated web worker, and
added color detection so the shadow layers carry the photo's palette. The
algorithm itself is Peter Selinger's; what grew from it is its own thing.

See the root `LICENSE` for the full GPL-2.0 text and the in-app documentation
(`src/content/documentation.md`, "How posters are made") for the user-facing
credit.

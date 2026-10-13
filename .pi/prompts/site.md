---
description: Start a static site from the example, build it, and publish it
argument-hint: "[folder] [what to change]"
---

From the harness root, start a site in `${1:-apps/site}` from the static
example, unless that folder already exists:

    brayness example static ${1:-apps/site}
    cd ${1:-apps/site} && npm install

Articles are Markdown in `content/articles/`; `site.json` holds the name,
tagline, and URL; `partials/` holds the header, nav, and footer; `static/`
holds CSS, fonts, and images. Then make this change: ${@:2}. If no change is given, ask for one.

Build and publish:

    npm run build
    brayness publish dist

`brayness publish` prints the site's link. Give it to me, and publish again
after every change so a reload shows it.

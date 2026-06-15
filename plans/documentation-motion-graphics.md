# Documentation Motion Graphics

Status: **proposal — not started.** This captures the thinking so it can be reviewed before any code is written.

## Goal

Our in-app documentation describes visual, dynamic features with words. The five-layer
poster pipeline, the geology layers peeling apart, layer isolation, gradient pulls — these
are things you understand by _seeing them move_, and right now they live as prose in
`About.vue` and `documentation.md`. The goal is to replace the word-bound explanations of
the **poster engine** with live, self-animating explainers that run the real engine.

Scope is **in-app documentation only.** GitHub does not need heavy visual explanation.

## The decision trail (how we got here)

We considered three approaches, in order, and discarded the first two:

1. **HyperFrames → pre-rendered video, shipped as a build artifact.**
   Render clips from the live poster engine, output `.webm` to `public/video/`, hash them
   into `build-manifest.json`, attach to releases. Elegant provenance story, but it means
   pre-rendering a video _of our own engine_ and then shipping the engine _again_ in the
   app. Redundant. Also adds a render pipeline, input-hash caching, and a headless
   determinism caveat.

2. **HyperFrames, but capture the client component for docs.**
   Build client-side first, then capture to video only for surfaces that need a file
   (GitHub markdown, sharing). Still carries a capture step.

3. **Client-side, in-app — chosen.**
   The poster engine already runs client-side. An exploded-view explainer is just driving
   existing scene state on a timeline. No render pipeline, no capture, no artifact to drift.
   The explainer _is_ the app, so it is intrinsically in sync with current code.

GitHub is explicitly out of scope, which removes the only reason a captured artifact was
needed. So approaches 1 and 2 fall away entirely.

## Why the engine reuse is clean

The exploded view is **already built** — it is existing scene state, not new animation.

- `src/3d/scenes/create-poster-scene.js` — `create_poster_scene(svg_string)` builds the full
  layered poster: five mosaic/geology layers (`boulders → sediment`), shadow layers, and the
  `light/regular/medium/bold` stroke layers. Returns a controller with `scene`, `mount`,
  `update`, settings, and `wait_for_textures`.
- The z-separation between layers is three numbers, exposed as setters in
  `create-poster-scene-settings.js`:
  - `set_mosaic_spread(v)` → `group.position.z = i*i*v`
  - `set_shadow_spread(v)` and `set_group_gap(v)` → push shadow/stroke layers apart on z
- **"Explode the five layers" = sweep `mosaic_spread` / `shadow_spread` / `group_gap` from
  ~0 up to a large value and back.** That is the entire animation. No new geometry, no
  redrawing, no parallel art.

The update loop is already a deterministic time function:

- `create-poster-scene-update.js` — `scene.update(frame_state, input_state)` computes drift,
  breathing, and stroke pulse purely from `frame_state.elapsed_s`. Given a time T, it sets
  the scene. That is exactly the model a timeline-driven explainer needs.
- The realtime RAF clock lives in `engine/create-loop.js` and `engine/create-app.js`. For an
  explainer we either reuse the live app loop (the component is on screen anyway) or drive
  `elapsed_s` / spread values from our own timeline or from scroll position.
- `scenes/with-poster-scene.js` already mounts this scene headless for GLB export, so
  mounting it outside the normal interactive path is proven.

Because the explainer runs `create_poster_scene` directly, any change to the layer model,
spread math, or lighting in `src/3d` shows up in the explainer on the next build. There is
nothing to keep in sync by hand.

## Where the explainers live

In-app documentation is markdown-driven plus live Vue sections:

- `/docs` → `src/views/Documentation.vue` renders `src/content/documentation.md`
  (`marked` + `DOMPurify`), builds a TOC, and appends a live `preferences-panel` — real
  interactive engine controls, **not** markdown.
- `/about` → `src/views/About.vue` — live poster scenes plus the feature list.

Key constraint: the markdown is rendered through `v-html` and sanitized by DOMPurify, so
**interactive components cannot be embedded inside the prose** — they would be stripped. The
existing `preferences-panel` is the pattern to follow: a real Vue section mounted _alongside_
the markdown, not inside it.

So each explainer is a Vue component placed as a section in `Documentation.vue` (and/or
`About.vue`), mounting `create_poster_scene` and driving spread/gap on a timeline (or tied to
scroll, or to the preferences the user toggles).

## Scope guard

The instinct to go overboard is the thing to design against. Guards:

- **Engine concepts only, for now.** The exploded view, geology layers peeling apart, layer
  isolation, gradient pulls — all reuse `create_poster_scene`. These are in scope.
- **Non-engine concepts stay prose.** Storage routing (localStorage vs IndexedDB thresholds),
  "HTML is the database," and the LORE film are **not** engine features — there is nothing to
  reuse, and building motion graphics for them is a separate, larger effort. Out of scope here.
- **No render pipeline, no capture, no new build step.** If that ever comes back on the table
  it is a deliberate, separate decision.

## Proposed phases

- **Phase 0 — Spike.** One self-animating exploded-view component (timeline-driven
  `mosaic_spread` / `shadow_spread` / `group_gap`), dropped into `Documentation.vue` as a
  single section, using a real admin poster. Validate it feels good and performs on screen.
  Stop and review.
- **Phase 1 — Round out the poster explainers.** Layer isolation, geology peel, gradient
  pulls — reuse the same component shell and scene controller.
- **Phase 2 — Placement pass.** Decide which explainers belong in `Documentation.vue` vs
  `About.vue`, and how they sit next to the existing prose and `preferences-panel`.

## Source of the poster

Explainers render from the **admin's poster list** (`VITE_ADMIN_ID`) — the same data
`About.vue` already loads via `use_posters()` / `for_person`. The hero explainer can use
`admin_posters[0]`, the same poster the About hero shows. No committed fixture needed.

## Open questions

- **Drive mechanism:** autoplay loop, scroll-linked, or user-driven (tie to the existing
  preference toggles)? Scroll-linked reads as "documentation"; autoplay reads as "demo."
- **Performance:** how many live WebGL scenes can sit on the `/docs` page at once before it
  needs to lazy-mount on scroll into view? `About.vue` already runs poster scenes, so there
  is a baseline to measure against.
- **Reduced motion:** the engine already reads `prefers-reduced-motion`; decide the static
  fallback for each explainer.

## Related change already made

`README.md` now points readers to the live in-app About and Documentation pages, since that
is where the visual explanations live. GitHub keeps the lighter, prose-only `docs/*.md`.

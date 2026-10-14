# Realness

_A harness for your anxious digital brain._

A shared harness for [pi](https://github.com/earendil-works/pi-coding-agent): skills, extensions, agent config, and the Realness product under `apps/realness/`.

The hosted starter is a separate allowlisted build of this harness. Each person owns their copy: they can use proposed starter updates, stop receiving them, or export their harness and Pi history. The update flow is planned; today, a hosted actor starts from the image and keeps its own files.

## Where things live

The harness sits at the root. Personal state and build output stay local.

```
realness/
├── apps/realness/       reference product and cloud tools
├── bin/                 harness launcher and helpers
├── vault/               personal notes (edit)
│   └── Projects/        every plan, one file each (edit)
├── work/                projects (edit)
│
└── .pi/
    ├── examples/        optional reference apps
    ├── node_modules/    harness dependencies (generated)
    ├── skills/          your skills (edit)
    ├── extensions/      your extensions (edit)
    ├── prompts/         your prompt templates (edit)
    ├── runtime/         reviewed Pi release and dependency lock
    └── agent/           PI'S HOME - all agent state in one place
        ├── settings.json    pi config (edit)
        ├── memory.db        session memory index (auto-generated, never synced)
        ├── models.json      model catalog (edit)
        └── npm/             ADD-ON CUPBOARD  (auto-generated - do not edit)
            └── node_modules/  THE ADD-ONS (loop, btw, autoresearch, ...)
```

`memory.db` is a derived FTS5 index over the configured session folder, built
by `.pi/extensions/memory/` so past work can be recalled by relevance. Delete
it any time; `remember` rebuilds it from the original transcripts. Compressed
sessions use the installed decoder, without a fork source checkout. The index
is never synced.

`bin/pi` keeps checkout state in `.pi/agent/`. An existing `~/.pi` stays separate;
startup does not copy or delete its configuration or credentials.

`.pi/skills/` and `.pi/extensions/` are the heart of the harness - they're where you teach the agent to work the way you do. Start with the ones you have, then build more as the need shows up.

They live in pi's standard project folders, `.pi/skills/`, `.pi/extensions/`, and `.pi/prompts/`. pi finds them on its own. Nothing goes in pi's global folder.

`.pi/skills/` is the single source of truth for skills:

- **pi** reads it directly.
- **Cursor**, **Claude Code**, and other agents read it through the `.cursor/skills`, `.claude/skills`, and `.agents/skills` symlinks.

Write a skill once in `.pi/skills/`, and it is available in every harness.

Owned code in `.pi/` uses `.js` with JSDoc. `npm run check:ext` rejects TypeScript there and `.mjs` in owned source. Installed dependencies, private agent state, external projects, and build output are excluded.

The shipped starter keeps `skills/`, `extensions/`, and `prompts/` at its root; the ship stage copies them from `.pi/`.

### The app

The harness uses a pinned build of our Pi fork, packaged under `.pi/runtime/`.
`npm install` installs harness dependencies under `.pi/node_modules/` and that runtime. Startup does not
download upstream Pi or borrow a globally installed Pi.

The release pin records the fork commit, upstream commit, and archive hashes.
`npm run pi:update` reinstalls the current pin; it does not advance upstream.
New fork releases follow `work/pi/FORK.md` and require review before changing the pin.
An explicit local `fork-path` marker still takes priority for development.

### The add-ons

`.pi/agent/npm/node_modules/` holds **extra pi packages** listed in `.pi/agent/settings.json` (loop, btw, autoresearch, etc.).

Update them: `./bin/pi update --extensions`

### Why is there a folder called `npm/`?

The name is misleading. It is **not** the npm program.

pi always stores downloaded add-ons in a folder called `npm/` inside its home directory - here, `.pi/agent/npm/`.

Think of it as **the add-on cupboard**, not "npm".

## Starter and personal files

The published starter includes `AGENTS.md`, selected skills, extensions, and required configuration. `AGENTS.local.md` is the personal place for agent instructions. The vault, `work/`, `artifacts/`, and Pi sessions belong to the person. A starter update must compare managed files with the version first received and show any personal edits before replacing them. Sessions help explain edits, but cannot detect all changes alone.

Plans live in a configured folder. This harness sets `brayness.plans` to `vault/Projects` in `package.json`; the built-in default is `vault/plans`. `brayness.plansIgnore` lists files in that folder that are not plans (here, `Todo's.md`). Readers do not fall back to top-level `plans/`.

## What to edit vs ignore

| You edit                                   | Auto-generated (ignore)         |
| ------------------------------------------ | ------------------------------- |
| `.pi/skills/`                              | `.pi/agent/npm/`                |
| `.pi/extensions/`                          | `.pi/agent/memory.db`           |
| `.pi/prompts/`                             | everything else in `.pi/agent/` |
| `vault/`                                   |                                 |
| `.pi/agent/settings.json`                  |                                 |
| `AGENTS.md`                                |                                 |
| `AGENTS.local.md` (personal, gitignored)   |                                 |
| `person.local.html` (personal, gitignored) |                                 |

`AGENTS.local.md` holds your preferences and quirks for the agent; it stays out of git. `person.local.html` says who this checkout belongs to, the phone itemids are minted under:

```html
<p itemscope itemtype="https://schema.org/Person">
  <a itemprop="telephone" href="tel:+14155551234">Your name</a>
</p>
```

Without it, a fresh checkout mints nothing. It also makes you an admin of your local stack, and the first admin of a new environment when you deploy its sync. After that, admins live in each environment's bucket: `npm --prefix apps/realness run webspace -- <env> admins`.

## How conversations go

Default to **discussion**: prose, talking it through, no question forms, no jumping to planning.
As we near the planning phase, shift to questions.

**All plans go in the configured plans folder (`vault/Projects/` here).** One file per plan, named `<project>-<topic>.md`. Never
inside a `work/<project>/` tree, not even a project's `docs/` - plans are read
across projects and belong in the vault.

## Personal context on demand

`/insert` splices `AGENTS.local.md` into `README.md` right before the last
command block and loads that combined view on your next prompt. Use it when you
want harness docs plus personal context in one shot instead of the default
session load.

## Start pi

```bash
npm install    # install dependencies and the pinned Pi fork
npm start      # open the harness
```

Requires Node >= 22.19 and Bash (macOS, Linux, or WSL). The first install needs
network access for runtime dependencies. Startup itself uses the installed fork.

Use `/login` in Pi to configure your own provider, then `/model` to choose a model.
Provider API-key environment variables also work. Saved credentials stay in
`.pi/agent/auth.json`; never commit that file. No Realness cloud account is required.

## Commands

Run npm commands from the repository root.

The shared command index is the Plans [Commands page](http://127.0.0.1:4323/commands/).
Run `npm run plans` to refresh and build it; `npm run plans:serve` serves it.
`npm run commands` refreshes the source page and `artifacts/commands/catalog.json`
without building Plans. The index covers package scripts, reviewed CLI routes,
and detected helpers, including Bash. Task buttons and search filter the list.
Entries carry source paths and execution limits; detection is not
proof that a command runs. Work projects and external tool subcommands are outside
this index.

| Command                              | Purpose and requirements                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `npm start` / `npm run realness`     | Start through `bin/pi`; Node >= 22.19.                                                                                 |
| `npm run pi:list`                    | List installed pi packages.                                                                                            |
| `npm run pi:update`                  | Reinstall the reviewed Pi fork pin; upstream updates require a new reviewed release.                                   |
| `npm test`                           | Run the memory index tests.                                                                                            |
| `npm run check:ext`                  | Run `bin/no-mjs.js` to reject `.mjs` files across the workspace (excluding artifacts, dependencies, and git metadata). |
| `npm run check:skills`               | Check every skill: spec rules via `uv`, stale paths, scripts that do not parse, long code blocks.                      |
| `npm run make:animation -- clip.mov` | Run `bin/make-animation.js`; requirements below.                                                                       |
| `npm run feeds`                      | Rebuild personal vault feeds; requires the local vault setup.                                                          |
| `npm run plans`                      | Build every plan in the plans folder through `apps/plans` into `artifacts/apps/plans/dist`.                            |

`npm run brayness` remains a compatibility alias for `npm run realness`.
Configuration keys such as `brayness.plans` remain compatible during migration;
they are not the public product name.

The feeds row is not a standalone clean-checkout command.

### Session storage migration

Close every Pi process. From a separate terminal in this folder:

```bash
node bin/session-relocate.js migrate
```

The command verifies closed history copies before setting `brayness.sessions`
to `vault/Sessions`. Duplicate filenames receive path-based suffixes. Original
files remain in `.pi/agent/sessions/`; the manifest records every original path.
Keep Pi closed until the command finishes. Restart through `bin/pi` afterward.

To reverse the move, close Pi again and run:

```bash
node bin/session-relocate.js rollback
```

Rollback preserves later entries and new sessions. It restores the legacy
setting without replacing unrelated settings. Changed originals block rollback.
Both locations remain available; neither command deletes history.

### Video to traced animation

Install FFmpeg and a Chromium browser (Chrome, Brave, Chromium, or Edge).
On macOS, FFmpeg is available with `brew install ffmpeg`.
The script uses the deployed `https://realness.online/poster-driver` page,
so rendering needs network access and that page must be available.

```bash
npm run make:animation -- clip.mov --fps 12 --workers 2
```

Output goes to `artifacts/animation/`. Traced SVG files remain for reuse.

| Option          | Default     | Effect                                                 |
| --------------- | ----------- | ------------------------------------------------------ |
| `--fps N`       | 24          | Frames per second.                                     |
| `--workers N`   | 6           | Parallel browser workers; reduce for lower memory use. |
| `--width N`     | Source size | Raster output width.                                   |
| `--crf N`       | 23          | Video compression, 0-51; higher makes smaller files.   |
| `--keep-frames` | Off         | Keep raster frames after encoding.                     |

Set `CHROME_PATH` to a browser executable if detection fails.
Set `REALNESS_URL` to use a different Realness deployment.
This command traces video frames; it does not generate artwork.

### Web media copies

`bin/for-web.sh` uses macOS file-size commands. Images require ImageMagick;
videos require FFmpeg (`brew install imagemagick ffmpeg`).

```bash
./bin/for-web.sh photo.jpg clip.mov
```

It writes `-web.jpg`, `-web.webp`, and `-web.mp4` beside the source files.
Originals stay unchanged. Existing output copies can be overwritten.
Without arguments, it processes supported files in the current directory.

## Scratch space

Everything the agent writes stays inside this repository - never `/tmp`, never outside the harness.
Scratch and one-off experiment files go in `artifacts/<project>/` at the harness root.
Leave scratch output for the owner to review before deleting it.

## More

- Agent instructions: `AGENTS.md`
- Setup: install Node >= 22.19, then run `npm install` and `npm start` from this checkout.
- Starter build: `apps/realness/tools/control/scripts/ship-stage.js` writes a versioned tree.

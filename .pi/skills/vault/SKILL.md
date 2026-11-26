---
name: vault
description: Read, search, and maintain the user's Obsidian vault at vault, a PARA-structured knowledge base of projects, interests, and reference material. Creates one if none exists. Use when the user asks about their notes or interests, or wants links categorized or feeds rebuilt.
metadata:
  check: 'command -v rg && bash -n rebuild-feeds.sh'
---

# Vault

## First priority: Readability is king

- Make notes easy to read before adding structure or automation.
- Say each thing once. Use short, plain sentences.
- Keep useful context; remove filler and repeated headings.
- Organize for the reader, not the tools.
- Use Markdown and semantic HTML for readable content.
- Use microdata so tools read the same content.

The vault is a PARA-structured Obsidian brain. Other skills read and write it.

## Location

```bash
VAULT=./vault   # from the harness root
```

## If there is no vault

Don't ask at session start. The first time a task needs the vault:

1. Ask once: "Do you have an Obsidian vault? Where is it?"
2. If they have one elsewhere, link it: `ln -s "<their vault>" vault`.
3. If not, create it:

```bash
mkdir -p "vault/"{"Projects","Areas","Resources","Archive",Clippings}
```

Then carry on with the original task.

## Structure

- `Projects/` -- active work with an end
- `Areas/` -- ongoing interests
- `Resources/` -- reference material
- `Archive/` -- inactive items
- `journal/` -- yearly journals
- `Clippings/` -- saved articles and links inbox (categorize into PARA sections)
- `Unsorted/` -- secondary inbox for uncategorized links

Each subfolder has a `:feed.md` with a dataview query listing its contents by date added. `:feed.md` is the convention for "show me what's in this section."

A plan is active only while it sits in the configured plans folder
(`realness.plans`). A plan filed in an Area is parked; moving it back resumes
it. This skill owns where a plan lives; the `planning` skill owns its shape.

## Orgs

An org is a group that shares files. Its folder is `orgs/+name/` at the
harness root, beside `vault/`, and the same path in sync. Git ignores it.

- `orgs/+name/members.html` is a Schema.org `Organization`: `name`,
  `alternateName` (the short name, as in `SMS`), `url`, `logo`, the
  founder, and the members. Only sync's org routes write it; never edit or
  move it on the Mac.
- An org's plans live in `orgs/+name/Projects/`, where its members read them.
  Share More Stories (`+share-more-stories`, short name SMS) holds the SEEQ
  plans. A scout plan stays in `vault/Projects/`; scouts look only there.
- Name an org by its short name in labels and filters: SMS, not
  `+share-more-stories`.
- Chat makes orgs, adds and removes people, and sets the name, short name,
  website, and logo, through sync's `v1/orgs` routes. `can` checks every
  call, so chat acts with the person's own rights. The account page only
  shows orgs.

Realness has two experiences. Human first: thoughts, posters, profiles, and
prints. Vault: plans, chat, the terminal, articles, and artifacts. A link
keeps a person in the experience they are in.

## In the app

People read these facts on the Docs page's Vault tab (`/vault/docs`).
Change both together.

- Every note opens at `/vault/<itemid>`; a move or rename keeps the link.
- A note's `layout:` line opens it in that frame: `article`, `canvas`, `deck`, or `print`.
- HTML tool pages are listed at `/vault/tools`.
- The app shows an edit live; nothing needs a build.

## Reading the vault

Use `read`, `rg`, or `find` directly against `$VAULT`. Examples:

```bash
# list a section
ls "$VAULT/Areas/Music/"

# literal search across the vault
rg -l "cowpunk" "$VAULT"

# show a section's feed
cat "$VAULT/Areas/Music/:feed.md"
```

For semantic search ("what notes feel related to X"), no tool exists yet -
fall back to `rg` with synonyms.

## Recent activity

When asked "what's been happening recently in my vault" or "what's new", run
`bash <skill-dir>/recent.sh`. It prints the end of the current journal, the most
recently changed notes, the newest notes per PARA section, the last 30 days of
`Clippings/` and `Unsorted/`, and project notes that look like status (todo,
release, log). If every timestamp matches (after a clone or bulk copy), trust
the journal and each note's `created` frontmatter instead.

## How feeds work

Each `:feed.md` contains a Dataview query that reads `created` (YAML frontmatter) to list items chronologically. Starred repos appear alongside regular notes by their repo creation date. The `github` column shows `owner/repo` for stars, blank for regular notes:

```dataview
TABLE created AS "Date", github AS "Source"
FROM "Areas/Music"
WHERE file.name != ":feed"
SORT created DESC
```

Regenerate all feeds from `skills/vault/`:

```bash
bash rebuild-feeds.sh
```

## Maintenance

```bash
./add-frontmatter.sh       # batch add YAML frontmatter to files missing it (extracts source URL, author from domain)
./add-stars.sh             # sync GitHub starred repos into vault (idempotent, skips existing via github: frontmatter key)
./rebuild-feeds.sh         # regenerate all :feed.md files (runs after add-stars.sh to surface new entries)
```

### GitHub stars sync

`add-stars.sh` fetches your starred repos (`GITHUB_USER`, or the `gh` login), categorizes each into the right PARA section using `skills/vault/github-stars-map.yaml` rules (topic matching with language/description fallbacks), and creates a note with `github: owner/repo` frontmatter. Re-runs are safe -- existing notes are skipped.

See `skills/vault/github-stars-map.yaml` for the categorization mapping. Override any misclassification by moving the note to the right directory and the feed will pick it up.

## Filing conventions

- Filename is the title -- do not duplicate it as a heading inside the note.
- Bare URLs trigger the auto-card-link plugin; do not wrap them.
- Unsorted is the inbox; anything there should be categorized into a PARA section and removed from Unsorted.
- **Add `created` date in frontmatter when organizing** -- use the file's original timestamp. Preserves capture date if files are ever copied/moved (filesystem ctime changes, frontmatter survives).
- **Frontmatter format:**
  ```yaml
  ---
  title: 'Filename as Title'
  source: 'https://example.com/article' # extracted from first URL in file
  author:
    - '[[Domain]]' # derived from source URL
  published:
  created: YYYY-MM-DD # from filesystem ctime
  description: ''
  tags:
    - 'reference'
  ---
  ```

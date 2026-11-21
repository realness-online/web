# Scout plans

A scout is a plan that reads public pages each day and lists people to
contact. A plan is a scout when `scout.html` sits beside its `index.md`.

## Folder

```
Projects/<plan>/
  index.md      the plan; the scout writes its ### Finds section
  scout.html    schedule, minutes, per_day, status (active or paused)
  Profile.md    who counts, the tests, the score
  Sources.md    where to look, one source per area
  Finds/        finds.html: every person ever found; repeats drop
  Runs/         runs.html, and one folder per run with pi.log
  Leads/        <date>.md: one day's report
```

## Who writes what

| Part                                     | Written by                       | Edit by hand |
| ---------------------------------------- | -------------------------------- | ------------ |
| `index.md` above `### Finds`             | a person                         | yes          |
| `### Finds` in `index.md`                | `src/scouts/digest.js`, each run | no           |
| `scout.html`, `Profile.md`, `Sources.md` | a person                         | yes          |
| `Finds/`, `Runs/`, `Leads/`              | `src/scouts/run.js`, each run    | no           |

## Finds

- One `<details>` block per day, newest first.
- A second run the same day replaces that day's block.
- Each row: score, link, why. Below 6 is dimmed.
- A plan with no `### Finds` heading gets no rows.
- Keep the heading; prune nothing inside it.

## Changing a scout

- Who to find and how to score: edit `Profile.md`. The next run uses it.
- Where to look: edit `Sources.md`.
- Pause: set `status` to `paused` in `scout.html`.
- Run one: `node scripts/scout.js <plan> --run` in `apps/realness`.
- Box against Mac: `npm run compare:scout`.

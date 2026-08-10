# Learning how Realness is used (no telemetry until the sample justifies it)

## The problem with dashboards and heatmaps here

Realness is a zero-tracking app. Building measurement tooling contradicts the
product, and it is already clear the sample size is too small to make it worth
it. Any dashboard today would be a mostly-empty dashboard whose data is noise
and whose existence puts a question mark on the zero-tracking promise.

So: **we do not measure yet.** We learn by experiment and by threshold. The
plan is to define the traffic level at which observation becomes worth it, and
only then decide whether - and how - to instrument. The threshold is the gate.

The metric that ultimately matters is not "usage" in the abstract - it is
**people who pay `$5` (the sponsorship)**, which only happens after the app
has proven useful for a while. So everything below tracks the path to that
`$5`, and the gate is a measure of whether a sponsorship funnel exists worth
reading yet.

## How we learn without measuring (now)

Small qualitative experiments, run at whatever traffic we have, pointed at the
path to sponsorship. These need no instruments, no collection, and cannot be
misread because there is no data to misread.

- **Talk to the people there is budget to serve.** Watch one live session with
  a real user (their consent). The question is not "what do they click" but
  "does this reach the point where `$5` feels fair?" - and if not, where they
  stop.
- **Read the edge/sponsorship queue.** What people ask before they consider
  paying, and what makes someone decline. Far more useful than usage counters
  for finding the value wall.
- **Ship one small change toward usefulness, read the reaction.** Realness
  must be useful for a while before anyone pays. So experiments are about
  lengthening that useful stretch (faster save, clearer export, a smoother
  first poster), not about measuring clicks.
- **Self-knowledge dashboard (no telemetry):** a view a user could see of
  their _own_ usage on _their_ device. It strengthens the "useful for a
  while" case by helping the user see value themselves - and is unreadable by
  anyone else.
- **Manual sponsor-watch.** When someone does pay `$5`, learn from them
  directly: what finally made it worthwhile, how long and how they used it
  first. That one person is the whole dataset at this scale, and worth more
  than any dashboard.

This is a value-wall funnel, not a usage funnel: the thing to learn is
_what must be true for someone to trade `$5` for it_, and that is learnable
qualitatively long before any metric is meaningful.

## When measurement is worth it: a traffic gate

Small experiments only produce signal past a usable sample. Below it, results
are noise and the cost (the promise) exceeds the value. Define the bar before
building anything:

| Signal                 | Why it matters                               | Suggested minimum before this is useful                                                           |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Funnel / feature usage | Anything below this makes counts meaningless | ~ weekly active posters + ~conversions that a single week can show a trend                        |
| Interaction heatmap    | Tiles need real repeated clicks to render    | interaction events per week large enough that per-tile counts are not dominated by one heavy user |
| Canvas working-map     | Needs many posters drawn at enough density   | posters drawn per week across multiple distinct users                                             |

Concretely (adjust to your real numbers):

- **A single number to start:** pick "distinct active users per week on
  realness.online." Estimate it (hosting logs / how many people you know use
  it). Call it `N`. (This app's hosting traffic shows the marketing number is
  small and the in-app number is unknown - see the gate section below.)
- **Experiment baseline:** a one-week push toward `$5` only yields signal
  when there is a steady trickle of buyers to observe. Below that, run
  qualitative experiments that lengthen the useful stretch.
- **Dashboard/telemetry threshold:** do not instrument until there is a real
  `pricing -> paid` conversion to study - i.e. sponsors are a steady trickle.
  Even then, the instrument
  must abide by the product rules from earlier (local, opt-in, aggregate,
  deliberate-actions-only, your instance only).

## What this plan commits to

1. **No telemetry now.** No dashboards, no heatmaps, no collection. Promise
   intact, sample too small, noise too high.
2. **Learn qualitatively** - conversations, support queue, small experiments,
   self-knowledge only (the user sees their own data on their own device).
3. **Define the gate: the sponsor stream.** A steady, queryable trickle of
   `$5` sponsors is the signal that reopens measurement of the
   `pricing -> paid` gap. No sponsors, no funnel worth reading - no measuring.
4. **Decision is deferred, not avoided.** We are not saying "never." We are
   saying "measure when there is something to measure, and not a day before."

## The metric that actually matters: path to $5

Everything reduces to one funnel:

```
arrive -> find it useful -> use it for a while -> trust it -> pay $5
```

You cannot see most of it without telemetry, and we do not measure. So the
trackable objectives are the ones that are visible without instruments:

- **Visitors to the sponsorship / pricing page** (`/pricing`) - already
  visible in host logs.
- **Actual `$5` payments** - visible in Stripe / the payment record.
- **Qualitative signal from whoever pays** - the richest data point at this
  scale.

The interesting gap is `/pricing` to `paid`: that is the conversion nobody can
see without signing in, and it is exactly the slice that would tell you whether
the funnel is working. For now it stays opaque, which is the price of not
tracking - and the reason the gate below is set where it is.

## The one number to track - and where we actually stand

Real numbers from `work/realness-ops` (`npm run traffic`, Firebase Hosting
logs, marketing pages only):

| Signal                             | Recent data (distinct IPs/day)                                    |
| ---------------------------------- | ----------------------------------------------------------------- |
| Landed on `/`                      | ~25-48/day typical, spikes to 100-145                             |
| Went deeper (`/about`, `/pricing`) | ~1-15/day combined                                                |
| 7d new outside arrivals            | ~4-22/7d - tool warns: under ~30, "read the shape, not the delta" |

Two hard realities from this data:

1. **This is marketing traffic, not app usage.** These are hits on landing
   pages. The actual Realness app (poster editor, feed, thoughts) sits behind
   phone sign-in as a PWA. Hosting logs tell us almost nothing about how many
   people are _inside_ the app drawing posters - which is the usage we actually
   care about.
2. **The real numbers are small.** ~30-40 IPs/day on the home page, of which a
   visible share is bot/scraper, and only 1-15 go deeper. Sustained weekly
   actives _in the app_ are well below the experiment baseline already stated.

## The gate, measured against $5 (not usage)

Because the target is sponsorship, the gate should be set by what converts to
`$5`, not by an invented weekly-active number. Working thresholds:

| Signal              | Gate                                  | Reason                                                                               |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `$5` sponsors       | A steady trickle, each one queried    | One payer per week gives a real dataset; zero payers gives nothing to measure        |
| `/pricing` visitors | Enough that a small % yields sponsors | if pricing sees ~1-15/day but converts ~0, the problem is value wall, not visibility |
| In-app actives      | Unknown (no telemetry)                | the number that would tell us the funnel works - and the one we refuse to collect    |

Against current numbers:

- **We do not know in-app actives**, and there may be almost zero paying
  sponsors. The funnel worth reading does not demonstrably exist yet. So
  `$5` measurements are not worth opening.
- **What would change the answer:** a real, sustained trickle of `$5`
  sponsors - each one already a gift of data you can capture by asking the
  person. That is the honest answer: at this scale you do not need a dashboard,
  you need a handful of sponsors to interview.
- **Decision deferred, not dead.** Watch `/pricing` traffic via `npm run
traffic`, and watch the sponsor stream. The moment sponsors become a real
  trickle, instrumenting to understand the `pricing -> paid` gap becomes worth
  it - because then there is a conversion to study. Until then the gate is
  simply not met, and the fight can rest.

## The plan in one line

Realness must be useful for a while before anyone pays `$5`. So right now we
learn what "use for a while" has to mean by talking to the few people who use
it and the few who pay - no instruments, no telemetry, no dashboards. When
sponsors become a steady trickle, revisit whether the `pricing -> paid` gap is
worth instrumenting to widen. The gate is the sponsor stream, not abstract
usage, and it is not met yet.

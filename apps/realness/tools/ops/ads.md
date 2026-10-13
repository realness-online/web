# Ads

OpenAI ads → `/about?topic=<topic>`. One topic per ad group.

```bash
npm run traffic -- --cache-only --days 14 --by-day
npm run ads -- --days 14   # needs OPENAI_ADS_API_KEY (~/.zshrc)
```

## Structure

Campaign = budget + dates. Ad group = one topic. Ad = creative.

Set `query_string_template` on the **ad group** (`topic=art`), null elsewhere.
Title ≤50, description ≤100.

## Topics

- `art` - tool for making
- `share` - pass it on
- `animators` - motion / layers (todo)
- `community` - host your own (todo)

## Creatives

**share**

- Title: `Realness — tell someone who still makes things`
- Body:
  `A rotoscoping tool with no ads in the feed. Trace photos into vectors on your device. Pass it on.`
- Alt title: `Realness — let's be fun again`

**art**

- Title: `Realness — Creativity Lives With You`
- Body:
  `Realness is a rotoscoping tool. Trace photos into expressive vector graphics on your device.`

**art**

- Title: `Realness — Lets be fun again`
- Body:
  `Realness is a rotoscoping tool. Trace photos into expressive vector graphics on your device.`

## Flight 1 (Jul 22-26, $100)

setting up. Mid-flight link/topic changes made segments incomparable. Tag the ad
group before launch; leave it alone.

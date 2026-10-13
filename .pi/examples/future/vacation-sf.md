# Future example: a shop for Vacation SF

Not built yet. This is the brief for when it is.

## Who

[Vacation SF](https://vacation-sf.com/) is a vintage store in North Beach, San
Francisco. It sells through Shopify today. It is the kind of customer Brayness
is for: a small independent shop that wants its own site and shop, owned
outright, without a platform taking a cut of every sale.

## What

A new example, `shop`, built like `app`: Vite, Vue, vue-router, and
`@realness.online/store`.

- **Every item is a document.** One `<article>` per piece, with Schema.org
  microdata: `Product` for the piece, `Offer` for its price and availability.
  Its itemid is `/<shop>/items/<created>`.
- **Vintage means one of each.** An item sells once. Sold items stay on the site,
  marked sold, the way Realness marks a sold print.
- **Browse:** a grid of items with photo, name, and price, then one page per item.
- **Cart:** kept in the browser, as a list of itemids. No account needed.
- **Check out:** hand the cart to a payment page, then mark each item sold.

## Done when

After a fresh `giget`, someone can browse, add to the cart, and check out.

## Open questions

- What does checkout mean with no server? Stripe Payment Links, one per item, or
  an order sent by email that the shop confirms by hand?
- Who marks an item sold, and how does every visitor's page learn it?
- Where do items live once published? The browser-only store will not do; this
  waits for the host file API (g5 in the Brayness plan).
- Does the shop owner edit items in the published site, or only in their session?
- Photos: traced posters from Realness, the original photos, or both?

## What it needs from Brayness

- **g5, host file API:** items and sold state stored on the host.
- **g1, identity:** only the owner edits items; anyone can browse.
- **g2, secrets:** a payment key, if checkout goes through Stripe.

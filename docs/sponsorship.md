# Sponsorship (voluntary Stripe payments)

Voluntary, pay-what-you-want support that surfaces on the Account view.

## How it works today (no backend)

- Stripe Buy Button with custom amount, configured in the Stripe dashboard.
- Frontend reads `VITE_STRIPE_BUY_BUTTON_ID` and `VITE_STRIPE_PUBLISHABLE_KEY` and renders Stripe's `<stripe-buy-button>` web component. The publishable key is safe to ship to the browser.
- The component lazy-loads `https://js.stripe.com/v3/buy-button.js` on the Account view only.
- We pass `client-reference-id="<me.id>"` so Stripe events can later be reconciled per user.
- Success URL on the Buy Button returns to:
  `https://<host>/account?sponsor=ok&session_id={CHECKOUT_SESSION_ID}`.
- On return, [`projects/web/src/views/Account.vue`](../src/views/Account.vue) calls [`projects/web/src/use/sponsor.js`](../src/use/sponsor.js) `record_session(session_id)`, which appends an entry to `me.sponsorship` and saves the profile via the existing `Me.save()` pipeline (HTML uploaded to Firebase Storage). The query is cleared with `router.replace('/account')`.

The data shape on the profile element:

```html
<address itemscope itemtype="/person" itemid="/+1234567890">
  <h3 itemprop="name">Scott</h3>
  <ol class="sponsorships">
    <li itemprop="sponsorship" itemscope itemtype="/sponsorship">
      <time itemprop="at" datetime="2026-05-04T00:00:00.000Z">May 4, 2026</time>
      <data itemprop="session" value="cs_test_abc123">cs_test_abc123</data>
    </li>
  </ol>
</address>
```

## Verification caveat

The redirect is trustable enough for a thank-you badge but not authoritative; a determined user can hit the success URL by hand. The UI says "Thanks for sponsoring", not "verified".

## Future: webhook-verified status (separate effort)

When a Functions backend lands:

- Subscribe to `checkout.session.completed` and `payment_intent.succeeded`.
- Look up the user via `client_reference_id`, write a `sponsor_verified_at` and amount onto the server profile.
- The UI should prefer the verified field when present.

## CSP

[`firebase.json`](../firebase.json) `script-src` includes `https://js.stripe.com` so the Buy Button script can load. The Buy Button opens Stripe Checkout in a top-level redirect (not an embedded iframe), so no `frame-src` change is required.

## Vue compiler

[`vite.config.js`](../vite.config.js) registers any `stripe-*` tag as a custom element so Vue's template compiler does not try to resolve it as a Vue component.

## Setup checklist

1. In Stripe dashboard: create a Buy Button. Set "Customer chooses price". Set success URL pattern shown above.
2. Copy the `buy_btn_...` id and the matching `pk_test_...` (or `pk_live_...`) publishable key into `.env.local` and the deploy environment as `VITE_STRIPE_BUY_BUTTON_ID` and `VITE_STRIPE_PUBLISHABLE_KEY`.
3. Test: signed in, click the Buy Button, complete a small test charge, return to `/account` - the badge should show "Thanks for sponsoring on <date>".

## Test mode vs live mode

Stripe Buy Buttons are tied to a mode: a `pk_test_...` key only works with a buy-button-id created in test mode. To run test charges in development, create a second Buy Button while toggled to "Test mode" in the dashboard and use that pair locally.

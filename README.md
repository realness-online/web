# Realness Online

![Realness](public/icons.svg)

Realness is for churches, punks, and veterans: any organization whose core tenants are at odds with advertising-based social networking.

Realness web is the source code for [realness.online](https://realness.online). This code is a tool for you to build and moderate your own social networks.

**Full functionality without tracking** - Realness works solely on the client, giving users complete control over their data and experience.

See Realness in action: the [About](https://realness.online/about) page walks through what it does with live posters, and the in-app [Documentation](https://realness.online/docs) explains every feature and preference. The richer, visual explanations live there.

Learn more about the [philosophy](docs/philosophy.md), [architecture](docs/architecture.md), how to [contribute](docs/contributing.md), or dive in and setup a Realness of your own.

## What Realness Does

Realness creates expressive vector graphics from your designs and photos. It works on any device. Once you save your creations, they integrate into any workflow that uses SVG.

### For Artists & Designers

- **Supremely animatable vector graphics** - Take a picture from your phone, and Realness creates a vector graphic composed into five animatable layers
- **Powerful workflow** - Works great on iPad with split view and export right into Affinity Designer
- **Optimized for the web** - Posters are optimized to be expressive, small, and run fast
- **Extract color palettes** - Use any one of eighteen gradients generated from your poster's prominent colors
- **High performance masking** - Smart use of opacity to merge colors between each of five layers creating natural movement

### For Communities

- **Create your own social network** - Use it with your design team, family, union hall, or any intimate community
- **Clear lines of responsibility** - Each instance has one moderator who takes responsibility for content
- **No tracking or analytics** - PWA means Realness is unindexed by search engines
- **Encourages internet literacy** - Helps people understand the power of the internet
- **No email, likes, links, or SEO** - Focus on real human connections

### For Developers

- **HTML is our database** - Build complete applications without backend coordination
- **Edge-first approach** - Native, fast, more secure with choices around data storage
- **Open source** - Modern best practices with semantic HTML described using microdata
- **Reduced attack surface** - Leave sensitive data on the device
- **Server is auth and storage only** - No backend processes required

## Client-Only Architecture

Realness provides **full functionality without any tracking**, working solely on the client:

- **localStorage** - Small data (preferences, viewbox coordinates, friend groups)
- **IndexedDB** - Large data (posters, thoughts, events)
- **No server dependency** - Everything works offline
- **Persistent state** - View states, preferences, and data survive page reloads
- **No analytics** - No tracking, no monitoring, no data collection

## Install

Realness uses [Vite+](https://viteplus.dev), a unified toolchain whose CLI is `vp`. The npm scripts proxy to it, so `npm run dev`, `npm run build`, and `npm test` all work - you can also call `vp` directly.

### Clone and install

```bash
git clone git@github.com:realness-online/web.git
cd web
npm install
npm run dev
```

This starts a plain HTTP dev server on `http://localhost:5173`.

### Local HTTPS (optional)

Some features (camera, service workers, secure contexts) need HTTPS. To serve over HTTPS on `realness.local`:

1. Install [mkcert](https://github.com/FiloSottile/mkcert) and create a local CA

```bash
brew install mkcert
mkcert -install
```

2. Generate certs in the project root

```bash
mkcert realness.local
```

3. Add `realness.local` to `/etc/hosts`

```bash
echo "127.0.0.1 realness.local" | sudo tee -a /etc/hosts
```

4. Run the dev server — it detects the certs and serves HTTPS on port 443

```bash
npm run dev
```

Visit `https://realness.local`.

### Configure firebase

Add a project from the [firebase console](https://console.firebase.google.com). Bear in mind that the name you give your project will be its url for your social network

`https://${project-name}.web.app`

Once your project is created you will want to enable phone authentication and file storage.

#### Enable phone authentication

- Click getting started from the authentication screen
- Edit the configuration for phone
- Enable and save

#### Enable Storage

- Click to get started from storage tab
- Accept the default security rules (they will be configured with deploy)
- Pick your region

### Deploy to firebase

`npm run deploy` builds the WebAssembly tracer, the workers, and the app, then deploys hosting and storage. Building the tracer needs [Rust](https://rustup.rs) and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

Install the Firebase CLI, log in, and deploy:

```bash
npm install -g firebase-tools

firebase login

npm run deploy
```

Visit `https://${project-name}.web.app`. You can sign in and invite your friends.

### Hot release (production cut)

Do this every time you ship `realness.online`. Same `dist/` for deploy and
GitHub - do not rebuild between the two. Firebase account must be the one that
owns the project (`firebase login` / `firebase use production`).

1. **Write the story** — add a `## … vX.Y.Z` section to `CHANGELOG.md`, bump
   `package.json` `"version"` to match, commit on `main`.
2. **Deploy + self-check**

   ```bash
   npm run deploy
   ```

   Builds, deploys hosting+storage, then verifies live bytes against that
   local `dist/build-manifest.json`. Expect `Result: LEGIT`.

3. **Publish the independent root of trust**

   ```bash
   npm run release:gh
   ```

   Creates the GitHub release for `$npm_package_version`, attaches
   `dist/build-manifest.json`, and fills notes from the matching changelog
   section (no interactive prompt).

4. **Prove it from GitHub**

   ```bash
   npm run verify
   ```

   Downloads the manifesto from the GitHub release and rehashes production.
   Expect `Trust: GitHub release` and `Result: LEGIT`.

Anyone else can run `npm run verify` after step 3. Detail:
[docs/verify-release.md](docs/verify-release.md).

## Optional server features (`realness-functions`)

**Default: do not deploy functions.** The web app is complete with Firebase
**Auth + Storage only**. Posters, feed, thoughts, phone sign-in, and moderation
all work without a backend beyond Firebase.

Deploy [realness-functions](https://github.com/realness-online/functions) only
when a moderator wants one of the optional capabilities below. It is a
**separate repo** deployed to the **same Firebase project** as this web app.

### When to deploy functions

| You want…                                                     | Deploy `realness-functions`? | Also configure                                                                        |
| ------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| A working Realness instance (posters, feed, auth, storage)    | **No**                       | Firebase Auth (phone) + Storage only                                                  |
| Web push notifications (Account toggle + scheduled broadcast) | **Yes**                      | `VAPID_PRIVATE_KEY` secret + matching public key in both repos (see functions README) |
| Block VoIP / virtual numbers before SMS (Twilio Lookup)       | **Yes**                      | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` secrets                                    |
| Stripe sponsorship checkout                                   | **No**                       | Hosted Stripe link in the web app; no server-side Stripe in functions                 |

If none of the optional rows apply, skip functions entirely.

### How the app decides (runtime, not build-time)

The app never assumes functions exist. At runtime it probes capabilities on the
**same origin**:

1. `GET /capabilities` — live manifest when hosting rewrites to deployed functions
2. `GET /capabilities.json` — static fallback shipped with the web app (all flags `false`)

Probe logic: `src/use/instance-capabilities.js`. Feature gates read the result:

| Flag              | When `true`                                                                                 | When `false` (default)                                  |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `push`            | Account notifications UI shown; subscriptions saved to Storage; scheduled broadcast can run | Notifications toggle hidden; no server push             |
| `phone_integrity` | Sign-in calls `POST /check-phone-integrity` before Firebase sends SMS                       | Sign-in uses Firebase phone auth only; no Twilio Lookup |

Web-only deploys never hit functions — the static fallback keeps every flag off.
No env vars are required in the web app for moderators (`VITE_FUNCTIONS_URL` is
an optional dev override for the functions emulator).

### Deploy functions (only if needed)

```bash
# In the realness-functions repo, same Firebase project as the web app
npm run deploy
```

Then redeploy hosting from this repo so the rewrites in `firebase.json` are
active (`/capabilities`, `/check-phone-integrity` → functions).

**Phone integrity:** `firebase functions:secrets:set TWILIO_ACCOUNT_SID` and
`TWILIO_AUTH_TOKEN`, then redeploy functions. Until both secrets exist,
`phone_integrity` stays `false` and the sign-in gate is off.

**Push:** set `VAPID_PRIVATE_KEY` and keep the public key in sync across both
repos — see `realness-functions/README.md`.

**Verify:** `GET https://your-instance.web.app/capabilities` should return JSON
(not the SPA). Confirm flags match what you configured before treating a
capability as live.

Details and emulator setup: [`realness-functions` README](../realness-functions/README.md).

## Contributing

Moderators are ideal contributors. Setting up an instance of realness is also setting yourself up to help. Please read our [guidelines](docs/contributing.md)

## Support

We invite you to [Join realness online](https://realness.online) if you are interested in contributing or getting some friendly technical support for Moderating

## License

Realness is licensed under the **GPL-2.0**. See [LICENSE](LICENSE) for the
full text. Anyone may run, modify, and redistribute Realness, including for
commercial use, provided derivative works stay GPL-2.0 with source available.

### One instance, one moderator

While the GPL governs the code, Realness is designed around a product
principle: one instance of Realness per human person, and that human person is
the moderator.

A moderator takes responsibility for the content that is created within their
instance of Realness.

By moderating an instance of Realness you become part of a chain of
responsibility that is diffuse. Each instance of Realness is a unique
opportunity for users to negotiate norms with their moderator. This way, human
beings can move between networks naturally; choosing a Realness that is a good
fit for them.

It is the explicit goal of realness to create a democratic environment where
people feel free to share and communicate yet it is clear whose ass is on the
line for what gets said, organized, and done.

### Commercial support

Commercial tiers at <https://realness.online/pricing> provide a formal
license agreement, support, and indemnification for teams and organizations.
The GPL permits commercial use freely; the commercial tiers are a service and
contract wrapper, not a license gate.

### Trademarks

The "Realness" name and logos are trademarks of Scott Fryxell and are not
licensed under the GPL. A redistributed or modified version must not use the
Realness marks in a way that implies it is the official project or is
endorsed by the author.

### Attribution

Realness's vector tracing is built on two GPL-2.0 projects: potrace by Peter
Selinger (<http://potrace.sourceforge.net/>) and node-potrace by mattmc
(<https://github.com/tooolbox/node-potrace>), the JavaScript port
`src/potrace/` is derived from. Both are credited in the in-app
documentation and remain GPL-2.0.

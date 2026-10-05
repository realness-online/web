# Blog and plans apps

From a harness root, `apps/<name>/app.json` selects original vault files by
catalog identity and assigns stable slugs. Builds stay in `artifacts/apps/`.

## Commands

```sh
node work/brayness/apps/bin/apps.js app build blog
node work/brayness/apps/bin/apps.js app publish blog --url <sync-url>
node work/brayness/apps/bin/apps.js app unpublish blog --url <sync-url>
```

Publishing uses the existing `brayness-store` sign-in. `TOKEN` can supply an
ID token for tests. No storage key goes into the app or its output.

- Build and private sync do not publish.
- Publish rebuilds without drafts, then uploads an immutable snapshot.
- Activation follows the last successful upload.
- Only selected articles and attachments enter that snapshot.
- App identity and slugs preserve links when sources move.
- Unpublish removes the active snapshot, leaving personal files intact.

`APPS_EXAMPLE` selects a local static example checkout. Otherwise the renderer
is downloaded into `artifacts/apps-engine`. Outdated renderers are refused.

During the renderer refactor, use the reviewed local checkout:

```sh
APPS_EXAMPLE="$PWD/work/brayness-examples/static" node work/brayness/apps/bin/apps.js app build plans
```

## Tests

```sh
cd work/brayness/apps && npm test
```

The publish checks run the public command against a real local sync service,
then read its output without authentication. No cloud deployment is required.

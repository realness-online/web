# Publish

Builds the blog and plans recipes in a harness's `apps/` and publishes them.

From a harness root, `apps/<name>/app.json` selects original vault files by
catalog identity and assigns stable slugs. Builds stay in `artifacts/apps/`.

## Commands

```sh
node apps/realness/tools/publish/bin/publish.js app build blog
node apps/realness/tools/publish/bin/publish.js app publish blog --url <sync-url>
node apps/realness/tools/publish/bin/publish.js app unpublish blog --url <sync-url>
node apps/realness/tools/publish/bin/publish.js app publish blog --github <owner/repo> [--dry-run]
```

`--github` builds without drafts and commits `dist/` onto the `gh-pages`
branch with your own git login, keeping history, `CNAME`, and `.nojekyll`.
`--dry-run` commits in `artifacts/apps-github/<name>` and skips the push.

Publishing uses the existing `brayness-store` sign-in. `TOKEN` can supply an
ID token for tests. No storage key goes into the app or its output.

- Build and private sync do not publish.
- Publish rebuilds without drafts, then uploads an immutable snapshot.
- Activation follows the last successful upload.
- Only selected articles and attachments enter that snapshot.
- App identity and slugs preserve links when sources move.
- Unpublish removes the active snapshot, leaving personal files intact.

The renderer is `<examples>/static`, where package.json's `brayness.examples`
names the folder (default `examples`). `APPS_EXAMPLE` overrides it. Outdated
renderers are refused.

```sh
node apps/realness/tools/publish/bin/publish.js app build plans
```

## Tests

```sh
cd apps/realness && npm test
```

The publish checks run the public command against a real local sync service,
then read its output without authentication. No cloud deployment is required.

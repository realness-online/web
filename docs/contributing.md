# Realness – Contributing


![Realness](../src/style/icons.svg)

You should deploy your own instance of realness and understand the [philosopy](philosophy.md) and [architecture](architecture.md) and get a development setup going before contributing

`yarn deploy` runs linting and tests that global code coverages requirements are met. Artifacts are created that you can use to see exactly what lines of code are being covered by tests. and whats in the built files

## Scripts

I normally have three tabs on terminal running the following scripts

- `yarn serve` runs the client code
- `yarn workers:dev` keeps the workers current
- `yarn test --watch --coverage --verbose` runs tests with code coverage on whats been changed

replace `--watch` with `--watchAll` to get full coverage data with each change. There are some other scripts available in the `scripts` section of the `package.json` file.

### Config
For a fully functioning localhost save a file named `.env.local` to the root of your project with your projects keys

``` bash
VUE_APP_API_KEY=${firebase.apiKey}
VUE_APP_AUTH_DOMAIN=${firebase.authDomain}
VUE_APP_DATABASE_URL=${firebase.databaseUrl}
VUE_APP_PROJECT_ID=${firebase.projectId}
VUE_APP_STORAGE_BUCKET=${firebase.storageBucket}
VUE_APP_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
```

Start your local server and localhost will have the same functionality as when you deploy.

## Pull Request Guidelines

- The `main` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches. **Do not submit PRs against the `main` branch.**

- Work in the `src` folder and **DO NOT** checkin `dist` in the commits.

- It's OK to have multiple small commits as you work on the PR - GitHub will automatically squash it before merging.

- Make sure `npm test` passes. (see [development setup](#development-setup))

- If adding a new feature:
  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
  - If you are resolving a special issue, add `(fix #xxxx[,#xxxx])` (#xxxx is the issue id) in your PR title for a better release log, e.g. `update entities encoding/decoding (fix #3899)`.
  - Provide a detailed description of the bug in the PR. Live demo preferred.
  - Add appropriate test coverage if applicable.


### Committing Changes

Commit messages should follow the [commit message convention](./COMMIT_CONVENTION.md) so that changelogs can be automatically generated. Commit messages will be automatically validated upon commit. If you are not familiar with the commit message convention, you can use `npm run commit` instead of `git commit`, which provides an interactive CLI for generating proper commit messages.

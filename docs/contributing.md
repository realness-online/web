## Sign in via localhost

For a fully functioning localhost save a file named ```env.local``` to the root of your project with your projects keys

``` bash
VUE_APP_API_KEY=${firebase.apiKey}
VUE_APP_AUTH_DOMAIN=${firebase.authDomain}
VUE_APP_DATABASE_URL=${firebase.databaseUrl}
VUE_APP_PROJECT_ID=${firebase.projectId}
VUE_APP_STORAGE_BUCKET=${firebase.storageBucket}
VUE_APP_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
```

Restart your local server and localhost will have the same functionality as when you deploy. take a look at our [development setup](docs/setup.md)


# Realness web Contributing Guide

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

### scripts

``` bash
# watch and auto re-build dist/vue.js
$ npm run dev

# watch and auto re-run unit tests in Chrome
$ npm run dev:test

# build all dist files, including npm packages
$ npm run build

# run the full test suite, including linting/type checking
$ npm test
```

There are some other scripts available in the `scripts` section of the `package.json` file.

The default test script will do the following: lint with ESLint -> type check with Flow -> unit tests with coverage -> e2e tests. **Please make sure to have this pass successfully before submitting a PR.** Although the same tests will be run against your PR on the CI server, it is better to have it working locally.

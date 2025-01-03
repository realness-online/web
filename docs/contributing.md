# Realness – Contributing

![Realness](/public/icons.svg)

Joining [realness](https://realness.online) is the best way to get support (moral, and technical). We'd love to have your help.

The best way to start is deploy your own instance of realness and then read about the the [philosopy](philosophy.md) and [architecture](architecture.md).

Deploying creates an `artifacts` folder with reports on what files are generated.

`/artifacts/unit/coverage/lcov-report/index.html` will be particularly useful for understanding what code is being tested

## Scripts

A standard setup is usually three tabs in a terminal running the following scripts

- `npm run dev` runs the client code on `http://localhost:8080`
- `npm run dev:workers` keeps the workers current
- `nmp test` runs tests with code coverage

### Config

For a fully functioning localhost save a file named `.env.local` to the root of your project with your firebase keys. check out env.example for exact names

Start your local server and `localhost:8080` will be good to go

## Pull Request Guidelines

- The `main` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches. **Do not submit PRs against the `main` branch.**

- Work in the `src` folder and **DO NOT** checkin `dist` or `artifacts` in the commits.

- It's OK to have multiple small commits as you work on the PR

- Make sure `yarn test --coverage` passes. Deploying will fail if your changes drop code coverage.

- If adding a new feature:

  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
  - If you are resolving a special issue, add `(fix #xxxx[,#xxxx])` (#xxxx is the issue id) in your PR title for a better release log,
  - Provide a detailed description of the bug in the PR. Live demo preferred.
  - Add appropriate test coverage if applicable.

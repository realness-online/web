# Future example: emotion classification

For an app that names the emotion in a piece of text.

## What

- A page based on the `app` example, where the person pastes text.
- One model call returns the emotion labels.
- The call bills the app's owner, and the row names the app.
- It works when published; the app runs in its own VM.

## Done when

A signed-in owner classifies text, and a usage row lands under that owner
naming the app. A stranger's visit spends nothing.

## Open questions

- Which model and label set?
- Labels only, or a saved history?

## What it needs from Brayness

- A door from an app to a model, scoped to its owner. An app VM has no egress
  and no key today.
- The ledger row carries the app id, so the owner sees which app spent.
- The owner cookie gates the door, so a public visitor cannot spend the
  owner's quota.

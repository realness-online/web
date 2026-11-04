---
name: google-workspace
description: Read and act on Scott's Google account - Gmail, Drive, Calendar, Docs, and Sheets - through the Google REST APIs with his own OAuth client. Use when the user asks about Gmail messages, calendar events, Drive files, or a Google Doc or Sheet.
metadata:
  check: 'node scripts/workspace.js accounts'
---

# Google Workspace

`scripts/workspace.js` signs in once for each account and runs a short script
against the Google REST APIs. Credentials and tokens live in
`.pi/agent/state/google-workspace/`, which git ignores. Never print a token.

## Setup

1. Save the OAuth "Desktop app" client JSON as
   `.pi/agent/state/google-workspace/credentials.json`.
2. `node .pi/skills/google-workspace/scripts/workspace.js login --email <address>`
   opens the browser and stores the token.

`accounts` lists signed-in addresses. Each call needs `--email`; if the user
did not name one, run `accounts` and confirm.

## Calls

`exec` reads a script from stdin. It gets `call(url, { method, params, data })`
and `auth`, and prints what the script returns as JSON. One script per request;
use `Promise.all` for independent calls; ask only for the fields you need.

```bash
node .pi/skills/google-workspace/scripts/workspace.js exec --email me@gmail.com <<'JS'
const { messages } = await call('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
  params: { q: 'from:peter newer_than:7d', maxResults: 5 }
})
return Promise.all(messages.map(({ id }) =>
  call(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
    params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] }
  })
))
JS
```

## Endpoints

- Gmail: `https://gmail.googleapis.com/gmail/v1/users/me/...`
- Drive: `https://www.googleapis.com/drive/v3/files`
- Calendar: `https://www.googleapis.com/calendar/v3/calendars/primary/events`
- Docs: `https://docs.googleapis.com/v1/documents/<id>`
- Sheets: `https://sheets.googleapis.com/v4/spreadsheets/<id>/values/<range>`

Sending mail, deleting, or changing events and files needs the user's
approval first. A 401 or 403 means the token is stale or a scope is missing:
run `login` again.

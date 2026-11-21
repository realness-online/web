## Overview

Your vault is your own folder of notes, in Markdown. It syncs to your devices and to your computer in the cloud. Only you can read it. Start at [the vault](/vault), and open a note from a link or from search.

### Folders

| Folder       | What goes in it                                                   |
| ------------ | ----------------------------------------------------------------- |
| `Projects/`  | Work in progress. Plans that are active live here                 |
| `Areas/`     | Ongoing subjects with no end date. Plans parked here stop running |
| `Resources/` | Reference material                                                |
| `Archive/`   | Finished or inactive notes                                        |
| `Clippings/` | Web pages you saved, waiting to be filed                          |
| `Thoughts/`  | Your statements and posters, by date                              |
| `Journal/`   | Daily notes                                                       |
| `Sessions/`  | Every agent conversation, saved                                   |
| `Templates/` | Starting points for new notes                                     |

### Pages

A note's `layout:` line opens it in that frame: `article`, `canvas`, `deck`, or `print`. An edit shows at once.

### Write

Write notes in markdown. Write machine state as HTML pages, one article per item, with an itemid on the root.

### Reference

- [Commands](/vault/page#Areas/Realness/pages/commands.html) lists every command you can run, grouped by task.
- [Tools](/vault/tools) lists the tool pages in the vault.
- [Modules](/vault/page#Areas/Realness/pages/maps/modules.html) and [Ways in](/vault/page#Areas/Realness/pages/maps/ways-in.html) show how the system fits together.
- [Keys](/vault/page#Areas/Realness/pages/key-layouts.html) shows the key layouts for this machine.

### Open a note in the app

- **Signed in** - `/vault/<itemid>` opens any of your notes.
- **Shared** - a published note has a random key. `/vault#<key>` opens it for anyone, with no sign-in. The key does not change when you rename the note.
- A note that has its own published page opens that page.
- Diagrams in a note draw on the page.

### The agent and your vault

- The chat reads your notes to answer questions, and writes notes when you ask.
- Every chat and terminal session is saved in `Sessions/`. Ask the chat "what did we decide about X", and it searches them.
- The search index stays on your device and is rebuilt from your sessions. It does not sync.

**NEXT:** clippings get a kind, tags, and a folder after you save them.

---

## Chat

Chat is an agent that works for you. It runs in your browser, and its tools run on your computer in the cloud (see [Your computer](#your-computer)).

- **Open or close** - the chevron, or Option+\`.
- **One tab writes** - if another tab has the chat, this tab says so. Select **Use here** to take it back. Other tabs and your phone follow along.
- **Thinking** - open **Thinking** above a reply to see how the agent got there.
- **Jump to latest** - Ctrl+End, when you have scrolled up.
- **What it sees** - the page you are on. On a poster or a thought, it reads that item first.

The chat can read and change files in your vault, run commands, and start loops. It tells you what it did. It does not claim a thing worked without checking.

---

## Your computer

Each person gets their own small computer in the cloud, called an **actor**. Your files, your agent, and your terminal live there. Actors run on a shared machine called a **halo**.

- **Terminal** - `/terminal` opens a full terminal on your actor.
- **Sleep** - a halo with no activity for 13 minutes goes to sleep. Your disk stays.
- **Wake** - opening chat or the terminal wakes it. This takes about a minute. If it takes more than 90 seconds, you see the problem and can retry.
- **Who wakes it** - only you, signed in. Visitors to your published sites and people watching your chat do not.
- **Recovery** - if a halo fails, your actor comes back within 5 minutes from what was synced. Work that was not yet synced can be lost.

---

## Loops

A loop is an agent that keeps working on one goal without you. It runs in its own actor, beside yours.

Start one from your terminal or ask the chat:

```sh
realness loop "Find ten bakeries in the Haight that sell online"
realness loop report <id>
```

- A goal is 1 to 4000 characters.
- At most 3 loops run at once. A loop cannot start another loop.
- A loop stops at its run limit, at its deadline, or when you stop it.
- **[Loops](/admin)** lists your loops with status, runs, tokens, and start time. **Stop** ends one.
- Loops use models, so they cost money. See [Pricing](/pricing).

---

## Long-running work

For work that goes on for weeks, write a plan. The plan says what to do, and each run is saved as a session.

| Part                                           | Where it lives                         | Status |
| ---------------------------------------------- | -------------------------------------- | ------ |
| **Plan** - what to do                          | `vault/Projects/<name>.md`             | WORKS  |
| **Syncs** - which files the work may touch     | the plan's `## Syncs` list             | WORKS  |
| **Session** - what one run did                 | `vault/Sessions/`                      | WORKS  |
| **Loop** - one run                             | its own actor                          | WORKS  |
| **Schedule** - when the plan runs again        | `schedule:` in the plan's front matter | NEXT   |
| **Report** - new results since you last looked | the chat                               | NEXT   |

### Example: find clients for two businesses

1. Make one org for each business: `+fryxell` and `+sms`. See [Organizations](#organizations).
2. Write one plan for each: `vault/Projects/fryxell-find-clients.md`. The first line of Notes describes the ideal client. `## Syncs` names `orgs/+fryxell`.
3. Start a loop with the plan as its goal. The loop writes each lead into the org folder.
4. Read the leads, and keep the ones you want. The agent never contacts anyone for you.
5. Ask the chat about earlier runs. It searches your sessions.

Each plan sees only the folders in its Syncs. A Fryxell plan cannot read SMS files. Your rights decide this, not the agent's prompt.

---

## Organizations

An org is a shared folder for a group: your family, your business, or one client. Members read and write its files. Each client gets its own org, so clients never see each other.

| Folder           | Who reads it      |
| ---------------- | ----------------- |
| `people/+you/`   | only you          |
| `orgs/+name/`    | the org's members |
| `commons/+name/` | anyone            |

### Roles

- **Founder** - owns the org. Adds and removes members, deletes files, publishes, and closes the org.
- **Member** - reads, lists, and writes the org's files. Can leave.
- **Admin** - can start new orgs. Being an admin opens no org's files.

### Set one up

Today, an admin starts an org on sync with `POST v1/orgs` and a name such as `+family`. The person who starts it is the founder. Names are lower case, start with a letter, and never change.

**NEXT:** start orgs and name their members from the [Account](/account) page.

### Manage it

- **Members** - the founder adds people by name and phone number, and removes them by phone number. The list is `orgs/+name/members.html`.
- **Leave** - a member leaves. The founder cannot leave.
- **Close** - the founder closes the org. Every file is archived to the founder's own folder, then the org and what it published are deleted. Members keep copies they already downloaded. Sync stops.
- **Removed access** - a removed member stops syncing at once. Their queued changes are refused.

**NEXT:** hand an org to a new founder. The new founder must accept.

---

## Work with the world

Everything is private until you publish it. Sync and publishing are separate steps.

- **Publish a file** - the founder copies a finished org file to `commons/+name/`. Anyone can read it. The copy does not change until you publish again.
- **Withdraw** - the founder takes it down.
- **Publish a site** - from your terminal, `realness publish <directory>` puts a built site online at its own address.
- **Site versions** - `realness-site versions` lists them, `realness-site restore <version>` goes back to one, and `realness-site remove` takes the site offline and keeps its versions.

Published sites use a separate address from your signed-in pages. Visitors to your site never wake your halo.

**NEXT:** members other than the founder publish, with a separate grant.

---

## Advanced planning

Large work is a plan: a graph of steps, where some steps wait for others. The agent proposes, and you decide at each gate.

- **Where** - `vault/Projects/`. A plan is active only while it is in that folder.
- **Shape** - title, then a diagram, then `## Nodes`, then `## Notes`.
- **Nodes** - one row for each step: an id such as `a1`, a goal, an effort, and "done when".
- **Status** - done, in progress, blocked, or not started. Each has a color and a symbol in the diagram.
- **Gates** - the agent stops at each gate and asks you. Nothing runs past a gate without you.
- **Decisions** - one line each, in Notes. Settled questions move there.
- **Syncs** - the folders a task on this plan may touch.
- **Read it** - your plans render as pages. Ask the chat to open one.

Ask the chat "how should we approach X" to start a plan. Ask "check X" to verify finished work.

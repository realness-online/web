---
name: apple-mail
description: Search and read Scott's local Apple Mail, and extract attachments. Query by sender, recipient, subject, body preview, date, mailbox, unread, flagged, or attachments. Read-only. Use when the user asks about an email, a message from someone, an invoice or attachment in mail, or what is in their inbox.
metadata:
  check: 'bash -n apple-mail.sh'
---

# Apple Mail

`apple-mail.sh` reads the Mail SQLite envelope index and the `.emlx` files.
It never changes mail data. It needs Full Disk Access for the terminal that
runs pi; "Operation not permitted" means that access is missing.

```bash
MAIL=.pi/skills/apple-mail/apple-mail.sh

$MAIL search --from "peter@" --subject "dinner" --limit 5
$MAIL search --after 2026-02-01 --has-attachment
$MAIL search --body "invoice" --mailbox INBOX --unread
$MAIL info 783660
$MAIL read 783660
$MAIL attachment 783660
$MAIL attachment 783660 "Invoice.pdf"
$MAIL mailboxes
```

## Search flags

`--from`, `--to`, `--subject`, `--body`, `--mailbox` match substrings.
`--after` and `--before` take `YYYY-MM-DD`. `--unread`, `--flagged`, and
`--has-attachment` filter. `--limit` defaults to 20.

## Notes

- `search` prints `id|sender|sender_name|subject|received|status|flagged|mailbox|attachments`.
  The id is Mail's internal row id.
- `--body` searches Mail's plain-text preview, not the full body.
- `read` prints the raw RFC 822 message. A `.partial.emlx` has headers only.
- `attachment` copies files to `artifacts/apple-mail/<id>/` and prints that path.
- Mailbox names are percent-encoded: `%5BGmail%5D` is `[Gmail]`.
- Deleted messages are left out.

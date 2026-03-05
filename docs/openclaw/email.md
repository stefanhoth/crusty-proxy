---
name: email
description: Read and send emails via the crusty-proxy MCP server (IMAP for reading, SMTP for sending). Use for inbox management, reading messages, and composing emails.
homepage: https://en.wikipedia.org/wiki/IMAP
metadata:
  {
    "openclaw":
      {
        "emoji": "📧",
        "requires": { "bins": ["mcporter"] },
        "mcpServer": "crusty-proxy",
      },
  }
---

# Email (IMAP/SMTP)

Access email via MCP tools exposed by crusty-proxy. IMAP for reading, SMTP for sending.

**Constraints:** Read and send only — deleting, moving, or flagging messages is not supported.

## Tools

### `email.list_messages`

List messages in a mailbox folder. Returns summaries (no body content).

Parameters:
- `folder` — mailbox folder name, default `"INBOX"`
- `limit` — number of messages to return, default 20 (returns most recent first)
- `search` — search string matched against subject and sender

Returns: JSON array, each item: `uid`, `subject`, `from`, `date`, `size`, `seen` (boolean).

Example — unread inbox:
```json
{ "folder": "INBOX", "limit": 10, "search": "" }
```

Example — search for messages from a specific sender:
```json
{ "search": "newsletter@example.com", "limit": 5 }
```

---

### `email.get_message`

Fetch full content of a single message by its IMAP UID.

Parameters:
- `uid` (required) — IMAP UID integer from a `list_messages` result
- `folder` — folder containing the message, default `"INBOX"`

Returns: JSON with `uid`, `subject`, `from[]`, `to[]`, `cc[]`, `date`, `source` (raw MIME, truncated at 50 KB).

Notes:
- The `source` field is the raw MIME message. Extract the text or HTML part as needed.
- UIDs are folder-scoped — always pass the correct `folder` if not INBOX.

Example:
```json
{ "uid": 12345, "folder": "INBOX" }
```

---

### `email.send_message`

Send an email via SMTP.

Parameters:
- `to` (required) — recipient address string or array of strings
- `subject` (required) — email subject
- `text` (required) — plain text body
- `html` — optional HTML body (send both for proper email clients)
- `cc` — string or array of CC recipients
- `reply_to` — Reply-To address

Returns: JSON with `messageId` and `accepted` array.

Example — simple message:
```json
{
  "to": "alice@example.com",
  "subject": "Meeting notes",
  "text": "Hi Alice,\n\nHere are the notes from today's meeting...\n\nBest regards"
}
```

Example — with CC and HTML:
```json
{
  "to": ["alice@example.com", "bob@example.com"],
  "cc": "manager@example.com",
  "subject": "Project update",
  "text": "Project is on track.",
  "html": "<p>Project is <strong>on track</strong>.</p>"
}
```

## Decision guide

- User asks to check email / what's new → `email.list_messages` with `folder: "INBOX"`, `limit: 10`
- User asks about a specific email or sender → `email.list_messages` with `search`, then `email.get_message` for body
- User asks to reply → read original with `email.get_message`, then `email.send_message` with appropriate subject and body
- User asks to delete / archive → explain this is not supported via the proxy
- For long threads: list first to get UIDs, then fetch individual messages as needed

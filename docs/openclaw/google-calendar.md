---
name: google-calendar
description: Read and create Google Calendar events via the crusty-proxy MCP server. Use for scheduling, querying upcoming events, and creating appointments.
homepage: https://calendar.google.com
metadata:
  {
    "openclaw":
      {
        "emoji": "📅",
        "requires": { "bins": ["mcporter"] },
        "mcpServer": "crusty-proxy",
      },
  }
---

# Google Calendar

Manage calendar events via MCP tools exposed by crusty-proxy. All tools talk to Google Calendar API v3.

**Constraints:** Read and create only — deleting or updating existing events is not supported.

## Tools

### `calendar.list_events`

List events in a date range.

Parameters:
- `start_date` (required) — ISO 8601 date or datetime, e.g. `"2025-03-01"` or `"2025-03-01T00:00:00Z"`
- `end_date` (required) — same format
- `max_results` — integer, default 50
- `query` — free-text search within event titles, descriptions, locations

Returns: JSON array of events with `id`, `summary`, `start`, `end`, `location`, `description`, `status`.

Example — today's events:
```json
{ "start_date": "2025-03-05", "end_date": "2025-03-05T23:59:59" }
```

Example — next 7 days, only meetings:
```json
{ "start_date": "2025-03-05", "end_date": "2025-03-12", "query": "meeting", "max_results": 20 }
```

---

### `calendar.get_event`

Fetch full details of a single event, including attendees and HTML link.

Parameters:
- `event_id` (required) — Google Calendar event ID from a `list_events` result

Returns: JSON object with `id`, `summary`, `start`, `end`, `location`, `description`, `attendees[]`, `htmlLink`.

---

### `calendar.create_event`

Create a new calendar event.

Parameters:
- `summary` (required) — event title
- `start` (required) — ISO 8601 datetime, e.g. `"2025-03-10T14:00:00+01:00"`
- `end` (required) — ISO 8601 datetime
- `description` — optional notes or agenda
- `location` — optional address or room
- `attendees` — optional array of email strings

Returns: JSON with `id`, `htmlLink`, `summary`, `start`, `end`.

Example — create a meeting:
```json
{
  "summary": "Team sync",
  "start": "2025-03-10T14:00:00+01:00",
  "end": "2025-03-10T14:30:00+01:00",
  "description": "Weekly check-in",
  "attendees": ["alice@example.com", "bob@example.com"]
}
```

## Decision guide

- User asks "what's on my calendar today / this week" → `calendar.list_events`
- User asks about a specific event they mentioned → `calendar.list_events` with `query`, then `calendar.get_event` for details
- User asks to schedule something → `calendar.create_event`
- User asks to cancel or delete → explain this is not supported via the proxy
